"""Client for fetching historical earthquake data from USGS.

Uses the USGS FDSNWS Event Query API for historical data.
https://earthquake.usgs.gov/fdsnws/event/1/
"""
from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.utils.cache import TTLCache

logger = logging.getLogger(__name__)


class USGSHistoricalClient:
    """Client for fetching historical earthquake data from USGS."""

    BASE_URL = "https://earthquake.usgs.gov/fdsnws/event/1"

    def __init__(self) -> None:
        timeout = httpx.Timeout(60.0, connect=10.0)
        self.client = httpx.Client(timeout=timeout)
        self._cache: TTLCache = TTLCache(max_size=50, ttl_seconds=3600)

    def fetch_earthquakes(
        self,
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
        max_magnitude: Optional[float] = None,
        min_latitude: Optional[float] = None,
        max_latitude: Optional[float] = None,
        min_longitude: Optional[float] = None,
        max_longitude: Optional[float] = None,
        region: str = "worldwide",
    ) -> List[Dict[str, Any]]:
        """Fetch historical earthquake data with filters.

        Note: USGS limits to 20,000 results per query.
        For large date ranges we fetch year by year.

        Args:
            start_year: First year of interest.
            end_year: Last year of interest.
            min_magnitude: Minimum magnitude filter.
            max_magnitude: Optional maximum magnitude filter.
            min_latitude: Optional south boundary.
            max_latitude: Optional north boundary.
            min_longitude: Optional west boundary.
            max_longitude: Optional east boundary.
            region: ``"worldwide"`` or ``"us"`` to restrict to CONUS.

        Returns:
            List of parsed earthquake dicts.
        """
        cache_key = f"{start_year}_{end_year}_{min_magnitude}_{region}"

        cached = self._cache.get(cache_key)
        if cached is not None:
            if min_latitude is not None:
                cached = [
                    eq
                    for eq in cached
                    if min_latitude <= eq["latitude"] <= max_latitude
                    and min_longitude <= eq["longitude"] <= max_longitude
                ]
            return cached

        all_earthquakes: List[Dict[str, Any]] = []

        for year in range(start_year, end_year + 1):
            start_time = f"{year}-01-01"
            end_time = f"{year}-12-31" if year < end_year else f"{end_year}-12-31"

            params: Dict[str, Any] = {
                "format": "geojson",
                "starttime": start_time,
                "endtime": end_time,
                "minmagnitude": min_magnitude,
                "orderby": "time",
                "limit": 20000,
            }

            if max_magnitude:
                params["maxmagnitude"] = max_magnitude

            if region == "us":
                params["minlatitude"] = 24.0
                params["maxlatitude"] = 50.0
                params["minlongitude"] = -125.0
                params["maxlongitude"] = -66.0

            try:
                response = self.client.get(f"{self.BASE_URL}/query", params=params)
                response.raise_for_status()
                data = response.json()

                for feature in data.get("features", []):
                    eq = self._parse_feature(feature)
                    if eq:
                        all_earthquakes.append(eq)

            except httpx.HTTPStatusError as e:
                if e.response.status_code == 503:
                    logger.warning(
                        "USGS temporarily unavailable for year %d", year
                    )
                    raise Exception(
                        "USGS data source temporarily unavailable. "
                        "Please try again later."
                    )
                logger.error("Error fetching year %d: %s", year, e)
            except httpx.TimeoutException:
                logger.warning("USGS request timed out for year %d", year)
                raise Exception(
                    "USGS request timed out. "
                    "The server may be slow or unavailable."
                )
            except Exception as e:
                logger.error("Unexpected error fetching year %d: %s", year, e)

        self._cache.set(cache_key, all_earthquakes)
        return all_earthquakes

    def fetch_earthquakes_in_box(
        self,
        north: float,
        south: float,
        east: float,
        west: float,
        start_year: int = 1980,
        end_year: int = 2024,
        min_magnitude: float = 4.0,
    ) -> List[Dict[str, Any]]:
        """Fetch earthquakes within a specific bounding box.

        Args:
            north: North boundary latitude.
            south: South boundary latitude.
            east: East boundary longitude.
            west: West boundary longitude.
            start_year: First year of interest.
            end_year: Last year of interest.
            min_magnitude: Minimum magnitude.

        Returns:
            List of parsed earthquake dicts inside the box.
        """
        all_earthquakes: List[Dict[str, Any]] = []

        for year in range(start_year, end_year + 1):
            start_time = f"{year}-01-01"
            end_time = f"{year}-12-31"

            params: Dict[str, Any] = {
                "format": "geojson",
                "starttime": start_time,
                "endtime": end_time,
                "minmagnitude": min_magnitude,
                "minlatitude": south,
                "maxlatitude": north,
                "minlongitude": west,
                "maxlongitude": east,
                "orderby": "time",
                "limit": 20000,
            }

            try:
                response = self.client.get(f"{self.BASE_URL}/query", params=params)
                response.raise_for_status()
                data = response.json()

                for feature in data.get("features", []):
                    eq = self._parse_feature(feature)
                    if eq:
                        all_earthquakes.append(eq)

            except Exception as e:
                logger.error(
                    "Error fetching year %d in box query: %s", year, e
                )

        return all_earthquakes

    def _parse_feature(self, feature: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse a GeoJSON feature into the internal format.

        Args:
            feature: A single GeoJSON feature from the USGS API.

        Returns:
            Normalised earthquake dict, or ``None`` on failure.
        """
        try:
            props = feature.get("properties", {})
            geometry = feature.get("geometry", {})
            coordinates = geometry.get("coordinates", [0, 0, 0])

            time_ms = props.get("time")
            if time_ms is None:
                return None

            event_time = datetime.fromtimestamp(time_ms / 1000, tz=timezone.utc)

            return {
                "event_id": feature.get("id", ""),
                "magnitude": props.get("mag", 0),
                "magnitude_type": props.get("magType"),
                "place": props.get("place", "Unknown"),
                "event_time": event_time.isoformat(),
                "longitude": coordinates[0],
                "latitude": coordinates[1],
                "depth_km": coordinates[2] if len(coordinates) > 2 else 0,
                "significance": props.get("sig", 0),
                "tsunami": props.get("tsunami", 0),
                "url": props.get("url"),
            }
        except Exception as e:
            logger.error("Error parsing earthquake: %s", e)
            return None

    def get_year_range(self) -> Tuple[int, int]:
        """Get the year range of available data.

        Returns:
            Tuple of (min_year, max_year).
        """
        return (1970, datetime.now().year)

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()


# Singleton instance
_client: Optional[USGSHistoricalClient] = None


def get_usgs_historical_client() -> USGSHistoricalClient:
    """Get or create the USGS historical client singleton.

    Returns:
        The shared ``USGSHistoricalClient`` instance.
    """
    global _client
    if _client is None:
        _client = USGSHistoricalClient()
    return _client
