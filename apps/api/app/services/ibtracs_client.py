"""
Client for fetching historical hurricane data from NOAA IBTrACS.
International Best Track Archive for Climate Stewardship.
https://www.ncei.noaa.gov/products/international-best-track-archive
"""
from __future__ import annotations

import csv
import io
import logging
from datetime import datetime
from functools import lru_cache
from typing import Any, Dict, List, Optional, Tuple

import httpx

from app.utils.weather import wind_to_category

logger = logging.getLogger(__name__)


class IBTrACSClient:
    """Client for fetching historical hurricane data from IBTrACS."""
    
    # IBTrACS CSV data URL - last 3 years (near real-time)
    IBTRACS_LAST3_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.last3years.list.v04r01.csv"
    
    # IBTrACS full Atlantic basin URL
    IBTRACS_NA_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NA.list.v04r01.csv"
    
    # All basins (much larger file)
    IBTRACS_ALL_URL = "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.ALL.list.v04r01.csv"
    
    # Basin-specific URLs
    BASIN_URLS = {
        "NA": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NA.list.v04r01.csv",
        "EP": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.EP.list.v04r01.csv",
        "WP": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.WP.list.v04r01.csv",
        "NI": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.NI.list.v04r01.csv",
        "SI": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.SI.list.v04r01.csv",
        "SP": "https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r01/access/csv/ibtracs.SP.list.v04r01.csv",
    }
    
    def __init__(self):
        # Use shorter timeouts - NOAA servers can be slow/unavailable
        timeout = httpx.Timeout(10.0, connect=5.0)  # 5s connect, 10s total
        self.client = httpx.AsyncClient(timeout=timeout)
        self._cache: Dict[str, List[Dict]] = {}
    
    async def fetch_hurricanes(
        self,
        start_year: int = 1980,
        end_year: int = 2024,
        min_category: int = 0,
        basin: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical hurricane data with optional filters.
        Returns hurricanes with their full track data.
        """
        # Determine which URL to use
        if basin and basin in self.BASIN_URLS:
            url = self.BASIN_URLS[basin]
            cache_key = f"basin_{basin}"
        else:
            # Default to North Atlantic for initial implementation
            url = self.IBTRACS_NA_URL
            cache_key = "basin_NA"
        
        # Check cache
        if cache_key not in self._cache:
            raw_data = await self._fetch_and_parse_csv(url)
            self._cache[cache_key] = raw_data
        
        hurricanes = self._cache[cache_key]
        
        # Filter by year and category
        filtered = []
        for hurricane in hurricanes:
            year = hurricane.get("year", 0)
            max_cat = hurricane.get("max_category", 0)
            
            if start_year <= year <= end_year and max_cat >= min_category:
                filtered.append(hurricane)
        
        return filtered
    
    async def _fetch_and_parse_csv(self, url: str) -> List[Dict[str, Any]]:
        """Fetch and parse IBTrACS CSV data."""
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            
            return self._parse_ibtracs_csv(response.text)
        except httpx.HTTPStatusError as e:
            if e.response.status_code == 503:
                logger.warning("IBTrACS data source temporarily unavailable (503). NOAA NCEI server may be down.")
                raise Exception("IBTrACS data source temporarily unavailable. The NOAA NCEI server is currently down. Please try HURDAT2 datasets or try again later.")
            logger.error("Error fetching IBTrACS data (HTTP %d): %s", e.response.status_code, e)
            raise Exception(f"Failed to fetch IBTrACS data: {e}")
        except httpx.TimeoutException as e:
            logger.warning("IBTrACS request timed out: %s", e)
            raise Exception("IBTrACS request timed out. The NOAA server may be slow or unavailable.")
        except httpx.HTTPError as e:
            logger.error("Error fetching IBTrACS data: %s", e)
            raise Exception(f"Failed to fetch IBTrACS data: {e}")
    
    def _parse_ibtracs_csv(self, csv_text: str) -> List[Dict[str, Any]]:
        """Parse IBTrACS CSV format into structured hurricane data."""
        hurricanes: Dict[str, Dict[str, Any]] = {}
        
        reader = csv.DictReader(io.StringIO(csv_text))
        
        for row in reader:
            try:
                # Skip header rows (IBTrACS has multiple header rows)
                if row.get("SID", "").startswith("SID") or not row.get("SID"):
                    continue
                
                storm_id = row.get("SID", "")
                
                # Parse timestamp
                iso_time = row.get("ISO_TIME", "")
                if not iso_time or iso_time == " ":
                    continue
                    
                try:
                    timestamp = datetime.strptime(iso_time.strip(), "%Y-%m-%d %H:%M:%S")
                except ValueError:
                    continue
                
                # Parse coordinates
                lat_str = row.get("LAT", "")
                lon_str = row.get("LON", "")
                if not lat_str or not lon_str or lat_str == " " or lon_str == " ":
                    continue
                    
                try:
                    latitude = float(lat_str)
                    longitude = float(lon_str)
                except ValueError:
                    continue
                
                # Parse wind speed (use USA agency data primarily)
                wind_str = row.get("USA_WIND", "") or row.get("WMO_WIND", "") or "0"
                try:
                    wind_knots = int(float(wind_str)) if wind_str and wind_str.strip() else 0
                except ValueError:
                    wind_knots = 0
                
                # Parse pressure
                pressure_str = row.get("USA_PRES", "") or row.get("WMO_PRES", "")
                try:
                    pressure_mb = int(float(pressure_str)) if pressure_str and pressure_str.strip() else None
                except ValueError:
                    pressure_mb = None
                
                # Calculate Saffir-Simpson category from wind speed
                category = wind_to_category(wind_knots)
                
                # Get storm status
                status = row.get("USA_STATUS", "") or row.get("NATURE", "")
                
                # Create track point
                track_point = {
                    "timestamp": timestamp.isoformat(),
                    "latitude": latitude,
                    "longitude": longitude,
                    "wind_knots": wind_knots,
                    "pressure_mb": pressure_mb,
                    "category": category,
                    "status": status,
                }
                
                # Initialize or update hurricane record
                if storm_id not in hurricanes:
                    name = row.get("NAME", "UNNAMED")
                    if name == " " or not name:
                        name = "UNNAMED"
                    
                    basin = row.get("BASIN", "NA")
                    year = timestamp.year
                    
                    hurricanes[storm_id] = {
                        "storm_id": storm_id,
                        "name": name.strip(),
                        "year": year,
                        "basin": basin,
                        "max_category": category,
                        "max_wind_knots": wind_knots,
                        "min_pressure_mb": pressure_mb,
                        "track": [],
                        "start_date": timestamp.isoformat(),
                        "end_date": timestamp.isoformat(),
                    }
                
                # Update hurricane record
                hurricane = hurricanes[storm_id]
                hurricane["track"].append(track_point)
                hurricane["end_date"] = timestamp.isoformat()
                
                if wind_knots > hurricane["max_wind_knots"]:
                    hurricane["max_wind_knots"] = wind_knots
                    hurricane["max_category"] = category
                
                if pressure_mb and (
                    hurricane["min_pressure_mb"] is None or 
                    pressure_mb < hurricane["min_pressure_mb"]
                ):
                    hurricane["min_pressure_mb"] = pressure_mb
                    
            except Exception as e:
                # Skip problematic rows
                continue
        
        return list(hurricanes.values())
    
    def get_available_basins(self) -> List[str]:
        """Return list of available ocean basins."""
        return list(self.BASIN_URLS.keys())
    
    async def get_year_range(self, basin: Optional[str] = None) -> Tuple[int, int]:
        """Get the year range of available data."""
        # IBTrACS typically has data from 1842 onwards, but reliable data starts ~1980
        return (1980, datetime.now().year)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
_client: Optional[IBTrACSClient] = None


def get_ibtracs_client() -> IBTrACSClient:
    """Get or create the IBTrACS client singleton."""
    global _client
    if _client is None:
        _client = IBTrACSClient()
    return _client
