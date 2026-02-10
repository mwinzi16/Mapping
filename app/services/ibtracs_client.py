"""IBTrACS (International Best Track Archive) client.

Synchronous HTTP client using ``httpx.Client``.
Fetches and parses CSV data from NOAA NCEI.
"""
from __future__ import annotations

import csv
import io
import logging
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
# Basin URLs
# ------------------------------------------------------------------

IBTRACS_BASE = (
    "https://www.ncei.noaa.gov/data/"
    "international-best-track-archive-for-climate-stewardship-ibtracs/"
    "v04r01/access/csv/"
)

BASIN_URLS: Dict[str, str] = {
    "ALL": f"{IBTRACS_BASE}ibtracs.ALL.list.v04r01.csv",
    "NA": f"{IBTRACS_BASE}ibtracs.NA.list.v04r01.csv",
    "SA": f"{IBTRACS_BASE}ibtracs.SA.list.v04r01.csv",
    "EP": f"{IBTRACS_BASE}ibtracs.EP.list.v04r01.csv",
    "WP": f"{IBTRACS_BASE}ibtracs.WP.list.v04r01.csv",
    "SP": f"{IBTRACS_BASE}ibtracs.SP.list.v04r01.csv",
    "SI": f"{IBTRACS_BASE}ibtracs.SI.list.v04r01.csv",
    "NI": f"{IBTRACS_BASE}ibtracs.NI.list.v04r01.csv",
}


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


class IBTrACSClient:
    """Synchronous client for IBTrACS CSV data."""

    def __init__(self) -> None:
        timeout = httpx.Timeout(120.0, connect=15.0)
        self.client = httpx.Client(timeout=timeout)
        self._cache: TTLCache = TTLCache(max_size=20, ttl_seconds=7200)

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_available_basins(self) -> List[str]:
        """Return list of basin codes with available data.

        Returns:
            Sorted list of basin code strings.
        """
        return sorted(BASIN_URLS.keys())

    def fetch_hurricanes(
        self,
        basin: str = "ALL",
        start_year: int = 1980,
        end_year: int = 2024,
    ) -> List[HistoricalHurricane]:
        """Fetch and parse hurricane tracks from IBTrACS.

        Args:
            basin: Ocean basin code (e.g. ``"NA"``, ``"ALL"``).
            start_year: First year of interest.
            end_year: Last year of interest.

        Returns:
            List of ``HistoricalHurricane`` objects.

        Raises:
            Exception: On HTTP 503 or timeout from NCEI.
        """
        cache_key = f"ibtracs_{basin}_{start_year}_{end_year}"
        cached = self._cache.get(cache_key)
        if cached is not None:
            return cached

        url = BASIN_URLS.get(basin.upper(), BASIN_URLS["ALL"])

        try:
            response = self.client.get(url)
            response.raise_for_status()
            csv_text = response.text
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                raise Exception(
                    "IBTrACS data source temporarily unavailable (503). "
                    "Please try again later."
                ) from e
            raise
        except httpx.TimeoutException as e:
            raise Exception(
                "IBTrACS request timed out. The NCEI server may be slow."
            ) from e

        hurricanes = self._parse_ibtracs_csv(
            csv_text, start_year, end_year
        )
        self._cache.set(cache_key, hurricanes)
        return hurricanes

    # ------------------------------------------------------------------
    # CSV parsing
    # ------------------------------------------------------------------

    def _parse_ibtracs_csv(
        self,
        csv_text: str,
        start_year: int,
        end_year: int,
    ) -> List[HistoricalHurricane]:
        """Parse IBTrACS CSV into ``HistoricalHurricane`` objects.

        The IBTrACS CSV has two header rows (column names and units);
        subsequent rows each represent a single track point.

        Args:
            csv_text: Raw CSV string.
            start_year: Filter start year.
            end_year: Filter end year.

        Returns:
            List of ``HistoricalHurricane`` objects.
        """
        reader = csv.DictReader(io.StringIO(csv_text))

        # Skip units row (second header line)
        try:
            next(reader)
        except StopIteration:
            return []

        storms: Dict[str, Dict] = {}

        for row in reader:
            sid = row.get("SID", "").strip()
            if not sid:
                continue

            # Parse season / year
            try:
                season = int(row.get("SEASON", "0"))
            except (ValueError, TypeError):
                continue

            if season < start_year or season > end_year:
                continue

            # Parse track point
            try:
                iso_time = row.get("ISO_TIME", "").strip()
                if not iso_time:
                    continue
                timestamp = datetime.strptime(
                    iso_time, "%Y-%m-%d %H:%M:%S"
                ).replace(tzinfo=timezone.utc)

                lat = float(row.get("LAT", "0").strip())
                lon = float(row.get("LON", "0").strip())

                wind_raw = row.get("USA_WIND", "") or row.get("WMO_WIND", "")
                wind_knots = int(float(wind_raw.strip())) if wind_raw.strip() else 0
                pres_raw = row.get("USA_PRES", "") or row.get("WMO_PRES", "")
                pressure: Optional[int] = (
                    int(float(pres_raw.strip()))
                    if pres_raw.strip()
                    else None
                )

                nature = row.get("NATURE", "").strip()
                status = nature if nature else "TS"
                category = _wind_to_category(wind_knots)
            except (ValueError, TypeError):
                continue

            point = HurricaneTrackPoint(
                timestamp=timestamp,
                latitude=lat,
                longitude=lon,
                wind_knots=wind_knots,
                pressure_mb=pressure,
                category=category,
                status=status,
            )

            if sid not in storms:
                name = row.get("NAME", "UNNAMED").strip()
                basin_code = row.get("BASIN", "").strip()
                storms[sid] = {
                    "storm_id": sid,
                    "name": name if name else "UNNAMED",
                    "year": season,
                    "basin": basin_code,
                    "track": [],
                    "max_wind": 0,
                    "min_pres": None,
                    "max_cat": 0,
                }

            storms[sid]["track"].append(point)
            storms[sid]["max_wind"] = max(
                storms[sid]["max_wind"], wind_knots
            )
            storms[sid]["max_cat"] = max(storms[sid]["max_cat"], category)
            if pressure is not None:
                cur_min = storms[sid]["min_pres"]
                if cur_min is None or pressure < cur_min:
                    storms[sid]["min_pres"] = pressure

        # Build HistoricalHurricane objects
        result: List[HistoricalHurricane] = []
        for data in storms.values():
            track: List[HurricaneTrackPoint] = data["track"]
            if not track:
                continue
            result.append(
                HistoricalHurricane(
                    storm_id=data["storm_id"],
                    name=data["name"],
                    year=data["year"],
                    basin=data["basin"],
                    max_category=data["max_cat"],
                    max_wind_knots=data["max_wind"],
                    min_pressure_mb=data["min_pres"],
                    track=track,
                    start_date=track[0].timestamp,
                    end_date=track[-1].timestamp,
                )
            )

        return result

    # ------------------------------------------------------------------
    # Cleanup
    # ------------------------------------------------------------------

    def close(self) -> None:
        """Close the underlying HTTP client."""
        self.client.close()
