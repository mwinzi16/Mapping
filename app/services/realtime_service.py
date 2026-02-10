"""Real-time monitoring service — background thread for event polling.

Uses ``threading.Thread`` and ``time.sleep`` instead of asyncio.
Broadcasts new events via Flask-SocketIO and optionally sends email
alerts to matching subscribers.
"""
from __future__ import annotations

import logging
import math
import threading
import time
from datetime import datetime, timezone
from typing import Dict, Optional, Set

from flask import Flask

from app.extensions import db, socketio
from app.services.email_service import EmailService
from app.services.subscription_service import SubscriptionService
from app.services.usgs_client import USGSClient
from app.services.noaa_client import NOAAClient
from app.services.nasa_firms_client import NASAFirmsClient
from app.services.nws_client import NWSClient

logger = logging.getLogger(__name__)


class RealtimeService:
    """Polls external APIs for new catastrophe events and broadcasts them.

    Runs a daemon thread that periodically checks USGS, NOAA, NASA FIRMS
    and NWS for new data, emits SocketIO events, and sends email alerts.
    """

    def __init__(self, app: Flask) -> None:
        self._app = app
        self._usgs_client = USGSClient()
        self._noaa_client = NOAAClient()
        self._nws_client = NWSClient()
        self._firms_client = NASAFirmsClient()
        self._email_service = EmailService()
        self._subscription_service = SubscriptionService()

        # Track already-seen event IDs to avoid duplicate alerts.
        self._seen_earthquakes: Set[str] = set()
        self._seen_hurricanes: Set[str] = set()
        self._seen_wildfires: Set[str] = set()
        self._seen_severe_weather: Set[str] = set()

        self._running = False
        self._thread: Optional[threading.Thread] = None

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    def start(self) -> None:
        """Start the background monitoring thread (daemon)."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(
            target=self._monitor_loop, daemon=True
        )
        self._thread.start()
        logger.info("Realtime monitoring thread started.")

    def stop(self) -> None:
        """Signal the monitoring thread to stop."""
        self._running = False
        logger.info("Realtime monitoring thread stop requested.")

    # ------------------------------------------------------------------
    # Main loop
    # ------------------------------------------------------------------

    def _monitor_loop(self) -> None:
        """Poll external APIs in a loop with a 60-second interval."""
        while self._running:
            try:
                self._check_earthquakes()
                self._check_hurricanes()
                self._check_wildfires()
                self._check_severe_weather()
            except Exception:
                logger.exception("Error in realtime monitoring loop.")
            time.sleep(60)

    # ------------------------------------------------------------------
    # Per-source checkers
    # ------------------------------------------------------------------

    def _check_earthquakes(self) -> None:
        """Fetch recent earthquakes from USGS and broadcast new ones."""
        try:
            data = self._usgs_client.fetch_recent_earthquakes(
                hours=1, min_magnitude=2.5
            )
            for feature in data.get("features", []):
                eq_id = feature.get("id")
                if eq_id and eq_id not in self._seen_earthquakes:
                    self._seen_earthquakes.add(eq_id)
                    parsed = self._usgs_client.parse_feature(feature)
                    socketio.emit("earthquake", parsed, namespace="/events")
                    self._notify_subscribers("earthquake", parsed)
        except Exception:
            logger.exception("Error checking earthquakes.")

    def _check_hurricanes(self) -> None:
        """Fetch active storms from NOAA and broadcast new ones."""
        try:
            storms = self._noaa_client.fetch_active_storms()
            for storm in storms:
                storm_id = storm.get("storm_id")
                if storm_id and storm_id not in self._seen_hurricanes:
                    self._seen_hurricanes.add(storm_id)
                    socketio.emit("hurricane", storm, namespace="/events")
                    self._notify_subscribers("hurricane", storm)
        except Exception:
            logger.exception("Error checking hurricanes.")

    def _check_wildfires(self) -> None:
        """Fetch active fires from NASA FIRMS and broadcast new ones."""
        try:
            fires = self._firms_client.fetch_active_fires_usa(days=1)
            for fire in fires:
                fire_id = fire.get("source_id")
                if fire_id and fire_id not in self._seen_wildfires:
                    self._seen_wildfires.add(fire_id)
                    socketio.emit("wildfire", fire, namespace="/events")
                    # Wildfires are high-volume; skip per-fire emails.
        except Exception:
            logger.exception("Error checking wildfires.")

    def _check_severe_weather(self) -> None:
        """Fetch severe weather alerts from NWS and broadcast new ones."""
        try:
            alerts = self._nws_client.fetch_active_alerts(
                event_types=[
                    "Tornado Warning",
                    "Flash Flood Warning",
                    "Severe Thunderstorm Warning",
                ]
            )
            for alert in alerts:
                alert_id = alert.get("source_id")
                if alert_id and alert_id not in self._seen_severe_weather:
                    self._seen_severe_weather.add(alert_id)
                    socketio.emit(
                        "severe_weather", alert, namespace="/events"
                    )
                    self._notify_subscribers("severe_weather", alert)
        except Exception:
            logger.exception("Error checking severe weather.")

    # ------------------------------------------------------------------
    # Subscriber notification
    # ------------------------------------------------------------------

    def _notify_subscribers(
        self,
        event_type: str,
        event_data: dict,
    ) -> None:
        """Send email alerts to matching subscribers.

        Opens a Flask application context so that ``db.session`` is
        available inside the background thread.

        Args:
            event_type: Event category key.
            event_data: Parsed event dict.
        """
        with self._app.app_context():
            try:
                subscribers = (
                    self._subscription_service.get_active_subscribers(
                        event_type=event_type
                    )
                )
                for sub in subscribers:
                    if not self._event_matches_subscription(
                        event_type, event_data, sub
                    ):
                        continue
                    if (
                        sub.emails_sent_today >= sub.max_emails_per_day
                    ):
                        continue

                    success = self._email_service.send_alert_email(
                        to_email=sub.email,
                        event_type=event_type,
                        event_data=event_data,
                        unsubscribe_token=sub.unsubscribe_token or "",
                    )
                    if success:
                        self._subscription_service.increment_email_count(
                            sub.id
                        )
            except Exception:
                logger.exception(
                    "Error notifying subscribers for %s", event_type
                )

    # ------------------------------------------------------------------
    # Subscription matching
    # ------------------------------------------------------------------

    @staticmethod
    def _event_matches_subscription(
        event_type: str,
        event_data: dict,
        subscription: object,
    ) -> bool:
        """Check whether a specific event matches a subscriber's prefs.

        Includes haversine-based location filtering when the subscriber
        has configured a geographic restriction.

        Args:
            event_type: Event category key.
            event_data: Parsed event dict.
            subscription: A ``Subscription`` ORM instance.

        Returns:
            ``True`` when the event matches the subscriber's criteria.
        """
        sub = subscription  # alias for brevity

        # Magnitude / category thresholds
        if event_type == "earthquake":
            magnitude = event_data.get("magnitude", 0)
            if magnitude < getattr(sub, "min_earthquake_magnitude", 0):
                return False

        if event_type == "hurricane":
            category = event_data.get("category", 0) or 0
            if category < getattr(sub, "min_hurricane_category", 0):
                return False

        # Location filter (haversine)
        loc_filter: Optional[Dict] = getattr(sub, "location_filter", None)
        if loc_filter:
            event_lat = event_data.get("latitude")
            event_lon = event_data.get("longitude")
            if event_lat is not None and event_lon is not None:
                distance = _haversine_km(
                    loc_filter["latitude"],
                    loc_filter["longitude"],
                    event_lat,
                    event_lon,
                )
                if distance > loc_filter.get("radius_km", 500):
                    return False

        return True


# ----------------------------------------------------------------------
# Haversine helper
# ----------------------------------------------------------------------


def _haversine_km(
    lat1: float,
    lon1: float,
    lat2: float,
    lon2: float,
) -> float:
    """Calculate the great-circle distance between two points (km).

    Args:
        lat1: Latitude of point 1 in degrees.
        lon1: Longitude of point 1 in degrees.
        lat2: Latitude of point 2 in degrees.
        lon2: Longitude of point 2 in degrees.

    Returns:
        Distance in kilometres.
    """
    r = 6371.0  # Earth radius in km
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    d_phi = math.radians(lat2 - lat1)
    d_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(d_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(d_lambda / 2) ** 2
    )
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
