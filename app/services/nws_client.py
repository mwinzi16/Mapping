"""NOAA National Weather Service API Client.

Synchronous client for severe weather alerts, tornadoes, hail, flooding.
https://www.weather.gov/documentation/services-web-api
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class NWSClient:
    """Client for fetching severe weather data from NOAA NWS."""

    # NWS API base
    NWS_API = "https://api.weather.gov"

    # Storm Prediction Center for severe weather reports
    SPC_BASE = "https://www.spc.noaa.gov/climo/reports"

    def __init__(self) -> None:
        self.client = httpx.Client(
            timeout=30.0,
            headers={
                "User-Agent": "CatastropheMapping/1.0 (contact@example.com)",
                "Accept": "application/geo+json",
            },
        )

    def fetch_active_alerts(
        self,
        event_types: Optional[List[str]] = None,
        area: Optional[str] = None,
        urgency: Optional[str] = None,
        severity: Optional[str] = None,
    ) -> List[Dict[str, Any]]:
        """Fetch active weather alerts from NWS.

        Args:
            event_types: Filter by event names (e.g. ``["Tornado Warning"]``).
            area: US state code such as ``"CA"`` or ``"TX"``.
            urgency: ``Immediate``, ``Expected``, or ``Future``.
            severity: ``Extreme``, ``Severe``, ``Moderate``, or ``Minor``.

        Returns:
            List of parsed alert dicts.
        """
        params: Dict[str, str] = {"status": "actual"}

        if area:
            params["area"] = area
        if urgency:
            params["urgency"] = urgency
        if severity:
            params["severity"] = severity

        try:
            response = self.client.get(
                f"{self.NWS_API}/alerts/active", params=params
            )
            response.raise_for_status()

            data = response.json()
            alerts: List[Dict[str, Any]] = []

            for feature in data.get("features", []):
                props = feature.get("properties", {})
                event = props.get("event", "")

                if event_types:
                    event_lower = event.lower()
                    if not any(et.lower() in event_lower for et in event_types):
                        continue

                alert = self._parse_alert(feature)
                if alert:
                    alerts.append(alert)

            return alerts
        except httpx.HTTPError as e:
            logger.error("Error fetching NWS alerts: %s", e)
            return []

    def fetch_tornado_warnings(self) -> List[Dict[str, Any]]:
        """Fetch active tornado warnings.

        Returns:
            List of tornado-related alert dicts.
        """
        return self.fetch_active_alerts(
            event_types=["Tornado Warning", "Tornado Watch", "Tornado"]
        )

    def fetch_flood_alerts(self) -> List[Dict[str, Any]]:
        """Fetch flood-related alerts.

        Returns:
            List of flood-related alert dicts.
        """
        return self.fetch_active_alerts(
            event_types=["Flood", "Flash Flood", "River Flood", "Coastal Flood"]
        )

    def fetch_severe_thunderstorm_alerts(self) -> List[Dict[str, Any]]:
        """Fetch severe thunderstorm alerts (includes hail).

        Returns:
            List of thunderstorm/hail alert dicts.
        """
        return self.fetch_active_alerts(
            event_types=["Severe Thunderstorm", "Hail"]
        )

    def fetch_spc_storm_reports(
        self,
        date: Optional[datetime] = None,
    ) -> Dict[str, List[Dict[str, Any]]]:
        """Fetch storm reports from Storm Prediction Center.

        Includes: tornadoes, hail, and damaging winds.

        Args:
            date: Report date. Defaults to today (UTC).

        Returns:
            Dict with keys ``tornadoes``, ``hail``, ``wind``.
        """
        if date is None:
            date = datetime.now(timezone.utc)

        date_str = date.strftime("%y%m%d")

        results: Dict[str, List[Dict[str, Any]]] = {
            "tornadoes": [],
            "hail": [],
            "wind": [],
        }

        for report_type in ["torn", "hail", "wind"]:
            url = f"{self.SPC_BASE}/{date_str}_rpts_{report_type}.csv"

            try:
                response = self.client.get(url)
                if response.status_code == 200:
                    reports = self._parse_spc_csv(response.text, report_type)
                    key = "tornadoes" if report_type == "torn" else report_type
                    results[key] = reports
            except httpx.HTTPError:
                continue

        return results

    def _parse_alert(self, feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse a NWS alert feature into the internal format.

        Args:
            feature: A GeoJSON feature from the NWS alerts endpoint.

        Returns:
            Normalised alert dict, or ``None`` when geometry is missing.
        """
        props = feature.get("properties", {})
        geometry = feature.get("geometry")

        lat, lon = self._get_geometry_centroid(geometry)

        if lat is None or lon is None:
            return None

        event = props.get("event", "")
        event_type = self._classify_event(event)

        return {
            "source_id": props.get("id", ""),
            "event_type": event_type,
            "latitude": lat,
            "longitude": lon,
            "location": props.get("areaDesc", ""),
            "description": props.get("headline", ""),
            "source": "NWS",
            "event_time": self._parse_iso_datetime(
                props.get("onset") or props.get("effective")
            ),
            "expires_at": self._parse_iso_datetime(props.get("expires")),
            "severity": props.get("severity"),
            "urgency": props.get("urgency"),
            "certainty": props.get("certainty"),
            "raw_event": event,
        }

    def _classify_event(self, event: str) -> str:
        """Classify NWS event string into an internal event type.

        Args:
            event: Raw event name from NWS.

        Returns:
            One of ``tornado``, ``hail``, ``flooding``, ``thunderstorm``, ``wind``.
        """
        event_lower = event.lower()

        if "tornado" in event_lower:
            return "tornado"
        elif "hail" in event_lower:
            return "hail"
        elif "flood" in event_lower:
            return "flooding"
        elif "thunderstorm" in event_lower:
            return "thunderstorm"
        elif "wind" in event_lower:
            return "wind"
        else:
            return "thunderstorm"

    def _get_geometry_centroid(
        self, geometry: Optional[Dict[str, Any]]
    ) -> tuple[Optional[float], Optional[float]]:
        """Extract centroid from GeoJSON geometry.

        Args:
            geometry: GeoJSON geometry dict (Point, Polygon, MultiPolygon).

        Returns:
            ``(latitude, longitude)`` or ``(None, None)`` on failure.
        """
        if not geometry:
            return None, None

        geom_type = geometry.get("type", "")
        coords = geometry.get("coordinates", [])

        if geom_type == "Point":
            return (coords[1], coords[0]) if len(coords) >= 2 else (None, None)
        elif geom_type == "Polygon" and coords:
            ring = coords[0]
            if ring:
                avg_lon = sum(c[0] for c in ring) / len(ring)
                avg_lat = sum(c[1] for c in ring) / len(ring)
                return avg_lat, avg_lon
        elif geom_type == "MultiPolygon" and coords:
            first_poly = coords[0]
            if first_poly and first_poly[0]:
                ring = first_poly[0]
                avg_lon = sum(c[0] for c in ring) / len(ring)
                avg_lat = sum(c[1] for c in ring) / len(ring)
                return avg_lat, avg_lon

        return None, None

    def _parse_spc_csv(
        self, csv_text: str, report_type: str
    ) -> List[Dict[str, Any]]:
        """Parse SPC storm report CSV.

        Args:
            csv_text: Raw CSV text from the SPC endpoint.
            report_type: One of ``torn``, ``hail``, ``wind``.

        Returns:
            List of parsed report dicts.
        """
        reports: List[Dict[str, Any]] = []
        lines = csv_text.strip().split("\n")

        if len(lines) < 2:
            return reports

        for line in lines[1:]:
            try:
                parts = line.split(",")
                if len(parts) < 7:
                    continue

                report: Dict[str, Any] = {
                    "source_id": (
                        f"SPC_{report_type}_{parts[5]}_{parts[6]}_{parts[0]}"
                    ),
                    "event_type": (
                        "tornado" if report_type == "torn" else report_type
                    ),
                    "latitude": float(parts[5]),
                    "longitude": float(parts[6]),
                    "location": parts[2] if len(parts) > 2 else "",
                    "county": parts[3] if len(parts) > 3 else "",
                    "state": parts[4] if len(parts) > 4 else "",
                    "source": "SPC",
                    "event_time": datetime.now(timezone.utc),
                }

                if report_type == "torn" and len(parts) > 1:
                    try:
                        report["tornado_scale"] = int(
                            parts[1].replace("EF", "").replace("F", "")
                        )
                    except ValueError:
                        pass
                elif report_type == "hail" and len(parts) > 1:
                    try:
                        report["hail_size_inches"] = float(parts[1]) / 100
                    except ValueError:
                        pass
                elif report_type == "wind" and len(parts) > 1:
                    try:
                        report["wind_speed_mph"] = int(parts[1])
                    except ValueError:
                        pass

                reports.append(report)
            except (ValueError, IndexError):
                continue

        return reports

    def _parse_iso_datetime(
        self, dt_str: Optional[str]
    ) -> Optional[datetime]:
        """Parse ISO datetime string.

        Args:
            dt_str: ISO-8601 datetime string, possibly with ``Z`` suffix.

        Returns:
            Parsed ``datetime`` or ``None``.
        """
        if not dt_str:
            return None
        try:
            dt_str = dt_str.replace("Z", "+00:00")
            return datetime.fromisoformat(dt_str)
        except ValueError:
            return None

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()
