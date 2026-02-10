"""USGS Earthquake API Client.

Synchronous wrapper around the USGS FDSNWS Event API.
https://earthquake.usgs.gov/fdsnws/event/1/
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class USGSClient:
    """Client for fetching earthquake data from USGS."""

    BASE_URL = os.environ.get(
        "USGS_API_BASE", "https://earthquake.usgs.gov/fdsnws/event/1"
    )

    def __init__(self) -> None:
        self.client = httpx.Client(timeout=30.0)

    def fetch_earthquakes(
        self,
        start_time: datetime,
        end_time: datetime,
        min_magnitude: float = 2.5,
        max_magnitude: Optional[float] = None,
        min_latitude: Optional[float] = None,
        max_latitude: Optional[float] = None,
        min_longitude: Optional[float] = None,
        max_longitude: Optional[float] = None,
        limit: int = 500,
    ) -> List[Dict[str, Any]]:
        """Fetch earthquakes from USGS API.

        Args:
            start_time: Start of the query window.
            end_time: End of the query window.
            min_magnitude: Minimum magnitude filter.
            max_magnitude: Optional maximum magnitude.
            min_latitude: Optional south boundary.
            max_latitude: Optional north boundary.
            min_longitude: Optional west boundary.
            max_longitude: Optional east boundary.
            limit: Maximum number of results.

        Returns:
            List of GeoJSON feature dicts.
        """
        params: Dict[str, Any] = {
            "format": "geojson",
            "starttime": start_time.isoformat(),
            "endtime": end_time.isoformat(),
            "minmagnitude": min_magnitude,
            "limit": limit,
            "orderby": "time",
        }

        if max_magnitude:
            params["maxmagnitude"] = max_magnitude
        if min_latitude:
            params["minlatitude"] = min_latitude
        if max_latitude:
            params["maxlatitude"] = max_latitude
        if min_longitude:
            params["minlongitude"] = min_longitude
        if max_longitude:
            params["maxlongitude"] = max_longitude

        response = self.client.get(f"{self.BASE_URL}/query", params=params)
        response.raise_for_status()

        data = response.json()
        return data.get("features", [])

    def fetch_earthquake_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single earthquake by USGS event ID.

        Args:
            event_id: The USGS event identifier.

        Returns:
            The GeoJSON feature dict or ``None``.
        """
        params = {
            "format": "geojson",
            "eventid": event_id,
        }

        try:
            response = self.client.get(f"{self.BASE_URL}/query", params=params)
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            return features[0] if features else None
        except httpx.HTTPError:
            return None

    def fetch_significant_earthquakes(self, days: int = 30) -> List[Dict[str, Any]]:
        """Fetch significant earthquakes feed.

        Args:
            days: Not used directly – USGS provides a monthly feed.

        Returns:
            List of GeoJSON feature dicts.
        """
        feed_url = (
            "https://earthquake.usgs.gov/earthquakes/feed/v1.0/"
            "summary/significant_month.geojson"
        )

        response = self.client.get(feed_url)
        response.raise_for_status()

        data = response.json()
        return data.get("features", [])

    def fetch_recent_earthquakes(
        self,
        hours: int = 1,
        min_magnitude: float = 2.5,
    ) -> Dict[str, Any]:
        """Fetch recent earthquakes from the last *hours*.

        Args:
            hours: Look-back window in hours.
            min_magnitude: Minimum magnitude filter.

        Returns:
            Raw GeoJSON response dict with ``features`` key.
        """
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        params: Dict[str, Any] = {
            "format": "geojson",
            "starttime": start_time.isoformat(),
            "endtime": end_time.isoformat(),
            "minmagnitude": min_magnitude,
            "orderby": "time",
        }

        try:
            response = self.client.get(f"{self.BASE_URL}/query", params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("Error fetching recent earthquakes: %s", e)
            return {"features": []}

    def parse_feature(self, feature: Dict[str, Any]) -> Dict[str, Any]:
        """Parse a GeoJSON feature into the internal format.

        Args:
            feature: A single GeoJSON feature dict.

        Returns:
            Normalised earthquake dict.
        """
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates", [0, 0, 0])

        return {
            "usgs_id": feature.get("id"),
            "magnitude": props.get("mag"),
            "magnitude_type": props.get("magType"),
            "place": props.get("place"),
            "event_time": datetime.fromtimestamp(
                props.get("time", 0) / 1000, tz=timezone.utc
            ),
            "updated_at": datetime.fromtimestamp(
                props.get("updated", 0) / 1000, tz=timezone.utc
            ),
            "longitude": coordinates[0],
            "latitude": coordinates[1],
            "depth_km": coordinates[2],
            "status": props.get("status"),
            "tsunami": props.get("tsunami", 0),
            "significance": props.get("sig", 0),
            "url": props.get("url"),
        }

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()
