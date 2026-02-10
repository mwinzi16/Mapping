"""HURDAT2 (Hurricane Database 2) client.

Synchronous HTTP client using ``httpx.Client``.
Fetches and parses the fixed-width HURDAT2 text format from NHC.
"""
from __future__ import annotations

import logging
import re
from datetime import datetime, timezone
from typing import Dict, List, Optional

import httpx

from app.schemas.parametric import (
    HistoricalHurricane,
    HurricaneTrackPoint,
)
from app.utils.cache import TTLCache

logger = logging.getLogger(__name__)


# ------------------------------------------------------------------
# Data source URLs
# ------------------------------------------------------------------

HURDAT2_ATLANTIC_URL = (
    "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2024-040824.txt"
)
HURDAT2_PACIFIC_URL = (
    "https://www.nhc.noaa.gov/data/hurdat/"
    "hurdat2-nepac-1949-2024-042324.txt"
)


def _wind_to_category(wind_knots: int) -> int:
    """Convert maximum sustained wind in knots to Saffir-Simpson category.

    Args:
        wind_knots: Wind speed in knots.

    Returns:
        Category 0–5 (0 = tropical storm / depression).
    """
    if wind_knots >= 137:
        return 5
    if wind_knots >= 113:
        return 4
    if wind_knots >= 96:
        return 3
    if wind_knots >= 83:
        return 2
    if wind_knots >= 64:
        return 1
    return 0


class HURDAT2Client:
    """Synchronous client for HURDAT2 text data from NHC."""

    def __init__(self) -> None:
        timeout = httpx.Timeout(120.0, connect=15.0)
        self.client = httpx.Client(timeout=timeout)
        self._cache: TTLCache = TTLCache(max_size=10, ttl_seconds=7200)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def fetch_hurricanes(
        self,
        basin: str = "atlantic",
        start_year: int = 1980,
        end_year: int = 2024,
    ) -> List[HistoricalHurricane]:
        """Fetch and parse hurricane tracks from HURDAT2.

        Args:
            basin: ``"atlantic"`` or ``"pacific"``.
            start_year: First year of interest.
            end_year: Last year of interest.

        Returns:
            List of ``HistoricalHurricane`` objects.

        Raises:
            Exception: On HTTP errors or timeouts.
        """
        cache_key = f"hurdat2_{basin}_{start_year}_{end_year}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        url = (
            HURDAT2_ATLANTIC_URL
            if basin.lower() == "atlantic"
            else HURDAT2_PACIFIC_URL
        )

        try:
            response = self.client.get(url)
            response.raise_for_status()
            text = response.text
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                raise Exception(
                    "NHC HURDAT2 data source temporarily unavailable (503). "
                    "Please try again later."
                ) from e
            raise
        except httpx.TimeoutException as e:
            raise Exception(
                "HURDAT2 request timed out. "
                "The NHC server may be slow or unavailable."
            ) from e

        basin_code = "AL" if basin.lower() == "atlantic" else "EP"
        hurricanes = self._parse_hurdat2(
            text, basin_code, start_year, end_year
        )
        self._cache.set(cache_key, hurricanes)
        return hurricanes

    # ------------------------------------------------------------------
    # HURDAT2 text parser
    # ------------------------------------------------------------------

    def _parse_hurdat2(
        self,
        text: str,
        basin_code: str,
        start_year: int,
        end_year: int,
    ) -> List[HistoricalHurricane]:
        """Parse the HURDAT2 fixed-width text format.

        The format alternates between header lines (starting with a
        basin code) and track-data lines.

        Header line format (comma-separated):
            ``AL012024,          ALBERTO,     10,``
            Fields: storm_id, name, number_of_track_entries

        Track line format (comma-separated, fixed-width):
            ``20240619, 0000, , TD, 19.4N,  93.5W,  30, 1007, ...``

        Args:
            text: Complete HURDAT2 file contents.
            basin_code: Basin identifier (``"AL"`` or ``"EP"``).
            start_year: Filter start year.
            end_year: Filter end year.

        Returns:
            List of ``HistoricalHurricane`` objects.
        """
        lines = text.strip().split("\n")
        hurricanes: List[HistoricalHurricane] = []

        i = 0
        while i < len(lines):
            line = lines[i].strip()
            if not line:
                i += 1
                continue

            # Detect header line
            parts = [p.strip() for p in line.split(",")]
            if len(parts) >= 3 and re.match(r"^[A-Z]{2}\d+", parts[0]):
                storm_id = parts[0]
                name = parts[1].strip() if parts[1].strip() else "UNNAMED"
                try:
                    num_entries = int(parts[2])
                except (ValueError, IndexError):
                    i += 1
                    continue

                # Extract year from the storm_id (last 4 chars)
                try:
                    year = int(storm_id[-4:])
                except ValueError:
                    i += num_entries + 1
                    continue

                if year < start_year or year > end_year:
                    i += num_entries + 1
                    continue

                track: List[HurricaneTrackPoint] = []
                max_wind = 0
                max_cat = 0
                min_pres: Optional[int] = None

                for j in range(1, num_entries + 1):
                    if i + j >= len(lines):
                        break
                    point = self._parse_track_line(lines[i + j])
                    if point is not None:
                        track.append(point)
                        max_wind = max(max_wind, point.wind_knots)
                        max_cat = max(max_cat, point.category)
                        if point.pressure_mb is not None:
                            if min_pres is None or point.pressure_mb < min_pres:
                                min_pres = point.pressure_mb

                if track:
                    hurricanes.append(
                        HistoricalHurricane(
                            storm_id=storm_id,
                            name=name,
                            year=year,
                            basin=basin_code,
                            max_category=max_cat,
                            max_wind_knots=max_wind,
                            min_pressure_mb=min_pres,
                            track=track,
                            start_date=track[0].timestamp,
                            end_date=track[-1].timestamp,
                        )
                    )

                i += num_entries + 1
            else:
                i += 1

        return hurricanes

    @staticmethod
    def _parse_track_line(line: str) -> Optional[HurricaneTrackPoint]:
        """Parse a single HURDAT2 track-data line.

        Args:
            line: A single track-data line.

        Returns:
            ``HurricaneTrackPoint`` or ``None`` on parse failure.
        """
        parts = [p.strip() for p in line.split(",")]
        if len(parts) < 8:
            return None

        try:
            # Date and time
            date_str = parts[0]  # YYYYMMDD
            time_str = parts[1]  # HHMM
            timestamp = datetime.strptime(
                f"{date_str}{time_str}", "%Y%m%d%H%M"
            ).replace(tzinfo=timezone.utc)

            # Status
            status = parts[3].strip() if parts[3].strip() else "TS"

            # Latitude (e.g. "19.4N")
            lat_str = parts[4]
            lat_val = float(lat_str[:-1])
            if lat_str[-1] == "S":
                lat_val = -lat_val

            # Longitude (e.g. "93.5W")
            lon_str = parts[5]
            lon_val = float(lon_str[:-1])
            if lon_str[-1] == "W":
                lon_val = -lon_val

            # Wind (knots) and pressure (mb)
            wind_knots = int(parts[6]) if parts[6] else 0
            pressure_raw = parts[7] if parts[7] else ""
            pressure: Optional[int] = (
                int(pressure_raw) if pressure_raw and int(pressure_raw) > 0 else None
            )

            category = _wind_to_category(wind_knots)

            return HurricaneTrackPoint(
                timestamp=timestamp,
                latitude=lat_val,
                longitude=lon_val,
                wind_knots=wind_knots,
                pressure_mb=pressure,
                category=category,
                status=status,
            )
        except (ValueError, IndexError):
            return None

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self.client.close()
