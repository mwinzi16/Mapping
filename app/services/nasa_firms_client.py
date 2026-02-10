"""NASA FIRMS (Fire Information for Resource Management System) API Client.

Synchronous client for active fire data.
https://firms.modaps.eosdis.nasa.gov/api/
"""
from __future__ import annotations

import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


class NASAFirmsClient:
    """Client for fetching active fire data from NASA FIRMS."""

    FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api"
    VIIRS_FEED = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs-snpp/csv"
    MODIS_FEED = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis/csv"

    def __init__(self, api_key: Optional[str] = None) -> None:
        self.api_key = api_key or os.environ.get("NASA_FIRMS_API_KEY")
        self.client = httpx.Client(timeout=60.0)

    def fetch_active_fires_usa(
        self,
        days: int = 1,
        source: str = "VIIRS_SNPP_NRT",
    ) -> List[Dict[str, Any]]:
        """Fetch active fires in the USA from the last *days*.

        Args:
            days: Look-back window in days.
            source: Satellite source identifier.

        Returns:
            List of parsed fire dicts.
        """
        if self.api_key:
            url = (
                f"{self.FIRMS_BASE}/area/csv/"
                f"{self.api_key}/{source}/USA/{days}"
            )
        else:
            return self._fetch_sample_fires()

        try:
            response = self.client.get(url)
            response.raise_for_status()

            fires = self._parse_csv_response(response.text, source)
            return fires
        except httpx.HTTPError as e:
            logger.error("Error fetching FIRMS data: %s", e)
            return self._fetch_sample_fires()

    def fetch_global_fires(
        self,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """Fetch global active fires.

        Args:
            hours: Not used directly; the FIRMS feed covers 24 h.

        Returns:
            List of parsed fire dicts.
        """
        geojson_url = (
            "https://firms.modaps.eosdis.nasa.gov/api/"
            "viirs_nrt/geojson/Global/24h"
        )

        try:
            response = self.client.get(geojson_url)
            if response.status_code == 200:
                data = response.json()
                return self._parse_geojson_fires(data)
        except Exception:
            pass

        return self._fetch_sample_fires()

    def _parse_csv_response(
        self, csv_text: str, source: str
    ) -> List[Dict[str, Any]]:
        """Parse CSV response from FIRMS.

        Args:
            csv_text: Raw CSV body.
            source: Satellite source for metadata.

        Returns:
            List of fire dicts.
        """
        fires: List[Dict[str, Any]] = []
        lines = csv_text.strip().split("\n")

        if len(lines) < 2:
            return fires

        headers = lines[0].split(",")

        for line in lines[1:]:
            values = line.split(",")
            if len(values) != len(headers):
                continue

            row = dict(zip(headers, values))

            try:
                fire: Dict[str, Any] = {
                    "source_id": (
                        f"FIRMS_{row.get('acq_date', '')}_"
                        f"{row.get('latitude', '')}_"
                        f"{row.get('longitude', '')}"
                    ),
                    "latitude": float(row.get("latitude", 0)),
                    "longitude": float(row.get("longitude", 0)),
                    "brightness": float(
                        row.get("bright_ti4", 0) or row.get("brightness", 0)
                    ),
                    "frp": (
                        float(row.get("frp", 0)) if row.get("frp") else None
                    ),
                    "confidence": self._parse_confidence(
                        row.get("confidence", "")
                    ),
                    "satellite": source.split("_")[0],
                    "source": "NASA FIRMS",
                    "detected_at": self._parse_datetime(
                        row.get("acq_date", ""), row.get("acq_time", "")
                    ),
                }
                fires.append(fire)
            except (ValueError, KeyError):
                continue

        return fires

    def _parse_geojson_fires(
        self, geojson: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Parse GeoJSON response from FIRMS.

        Args:
            geojson: GeoJSON FeatureCollection dict.

        Returns:
            List of fire dicts.
        """
        fires: List[Dict[str, Any]] = []
        features = geojson.get("features", [])

        for feature in features:
            props = feature.get("properties", {})
            coords = feature.get("geometry", {}).get("coordinates", [0, 0])

            fires.append(
                {
                    "source_id": (
                        f"FIRMS_{props.get('acq_date', '')}_{coords[1]}_{coords[0]}"
                    ),
                    "latitude": coords[1],
                    "longitude": coords[0],
                    "brightness": (
                        props.get("bright_ti4") or props.get("brightness")
                    ),
                    "frp": props.get("frp"),
                    "confidence": self._parse_confidence(
                        props.get("confidence", "")
                    ),
                    "satellite": props.get("satellite", "VIIRS"),
                    "source": "NASA FIRMS",
                    "detected_at": datetime.now(timezone.utc),
                }
            )

        return fires

    def _parse_confidence(self, confidence: str | int | float) -> int:
        """Convert confidence to numeric value.

        Args:
            confidence: Raw confidence value (string or number).

        Returns:
            Integer confidence percentage.
        """
        if isinstance(confidence, (int, float)):
            return int(confidence)
        conf_map = {
            "l": 30,
            "n": 50,
            "h": 80,
            "low": 30,
            "nominal": 50,
            "high": 80,
        }
        return conf_map.get(str(confidence).lower(), 50)

    def _parse_datetime(self, date_str: str, time_str: str) -> datetime:
        """Parse FIRMS date and time strings.

        Args:
            date_str: Date in ``YYYY-MM-DD`` format.
            time_str: Time in ``HHMM`` format.

        Returns:
            Parsed UTC datetime.
        """
        try:
            time_str = time_str.zfill(4)
            dt_str = f"{date_str} {time_str[:2]}:{time_str[2:]}"
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        except ValueError:
            logger.warning(
                "Failed to parse FIRMS datetime: date_str=%r, time_str=%r",
                date_str,
                time_str,
            )
            return datetime.now(timezone.utc)

    def _fetch_sample_fires(self) -> List[Dict[str, Any]]:
        """Return sample fire data when the API is unavailable.

        Returns:
            Empty list (production fallback).
        """
        return []

    def close(self) -> None:
        """Close the HTTP client."""
        self.client.close()
