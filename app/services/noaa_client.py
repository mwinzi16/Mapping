"""NOAA National Hurricane Center API Client.

Synchronous client for hurricane/tropical cyclone data.
https://www.nhc.noaa.gov/
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class NOAAClient:
    """Client for fetching hurricane/tropical cyclone data from NOAA."""

    ACTIVE_STORMS_URL = "https://www.nhc.noaa.gov/CurrentStorms.json"
    ATLANTIC_RSS = "https://www.nhc.noaa.gov/index-at.xml"
    PACIFIC_RSS = "https://www.nhc.noaa.gov/index-ep.xml"

    def __init__(self) -> None:
        self.client = httpx.Client(timeout=30.0)

    def fetch_active_storms(self) -> List[Dict[str, Any]]:
        """Fetch currently active tropical storms and hurricanes.

        Returns:
            List of parsed storm dicts.
        """
        try:
            response = self.client.get(self.ACTIVE_STORMS_URL)
            response.raise_for_status()

            data = response.json()
            storms: List[Dict[str, Any]] = []

            active_storms = data.get("activeStorms", [])
            for storm in active_storms:
                parsed = self.parse_storm(storm)
                if parsed:
                    storms.append(parsed)

            return storms
        except httpx.HTTPError as e:
            logger.error("Error fetching NOAA data: %s", e)
            return []

    def parse_storm(self, storm_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse NOAA storm data into the internal format.

        Args:
            storm_data: Raw storm dict from the NOAA API.

        Returns:
            Normalised storm dict, or ``None`` on parse failure.
        """
        try:
            return {
                "storm_id": storm_data.get("id"),
                "name": storm_data.get("name"),
                "classification": storm_data.get("classification"),
                "basin": storm_data.get("basin"),
                "latitude": float(storm_data.get("lat", 0)),
                "longitude": float(storm_data.get("lon", 0)),
                "max_wind_mph": int(storm_data.get("intensity", 0)),
                "max_wind_knots": int(
                    int(storm_data.get("intensity", 0)) * 0.868976
                ),
                "movement_direction": storm_data.get("movementDir"),
                "movement_speed_mph": storm_data.get("movementSpeed"),
                "pressure_mb": storm_data.get("pressure"),
                "headline": storm_data.get("headline"),
                "is_active": True,
            }
        except (ValueError, TypeError):
            return None

    def fetch_forecast(self, storm_id: str) -> Optional[Dict[str, Any]]:
        """Fetch forecast cone and track for a specific storm.

        Args:
            storm_id: The NOAA storm identifier.

        Returns:
            Forecast JSON dict or ``None``.
        """
        cone_url = (
            f"https://www.nhc.noaa.gov/storm_graphics/api/"
            f"{storm_id}_CONE_latest.json"
        )

        try:
            response = self.client.get(cone_url)
            if response.status_code == 200:
                return response.json()
        except httpx.HTTPError:
            pass

        return None

    def fetch_historical_tracks(
        self,
        year: int,
        basin: str = "AL",
    ) -> List[Dict[str, Any]]:
        """Fetch historical hurricane tracks from IBTrACS database.

        Args:
            year: Season year.
            basin: Ocean basin code.

        Returns:
            List of storm dicts for the given year.
        """
        ibtracs_url = (
            f"https://www.ncei.noaa.gov/data/"
            f"international-best-track-archive-for-climate-stewardship-ibtracs/"
            f"v04r00/access/json/ibtracs.{basin}.list.v04r00.json"
        )

        try:
            response = self.client.get(ibtracs_url)
            response.raise_for_status()

            data = response.json()
            storms = [s for s in data if str(year) in s.get("season", "")]
            return storms
        except httpx.HTTPError:
            return []

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()
