"""
NOAA National Hurricane Center API Client.
https://www.nhc.noaa.gov/
"""
from typing import Optional, List, Dict, Any
import httpx

from app.core.config import settings


class NOAAClient:
    """Client for fetching hurricane/tropical cyclone data from NOAA."""
    
    ACTIVE_STORMS_URL = "https://www.nhc.noaa.gov/CurrentStorms.json"
    ATLANTIC_RSS = "https://www.nhc.noaa.gov/index-at.xml"
    PACIFIC_RSS = "https://www.nhc.noaa.gov/index-ep.xml"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def fetch_active_storms(self) -> List[Dict[str, Any]]:
        """
        Fetch currently active tropical storms and hurricanes.
        """
        try:
            response = await self.client.get(self.ACTIVE_STORMS_URL)
            response.raise_for_status()
            
            data = response.json()
            storms = []
            
            active_storms = data.get("activeStorms", [])
            for storm in active_storms:
                parsed = self.parse_storm(storm)
                if parsed:
                    storms.append(parsed)
            
            return storms
        except httpx.HTTPError as e:
            print(f"Error fetching NOAA data: {e}")
            return []
    
    def parse_storm(self, storm_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Parse NOAA storm data into our internal format.
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
                "max_wind_knots": int(int(storm_data.get("intensity", 0)) * 0.868976),
                "movement_direction": storm_data.get("movementDir"),
                "movement_speed_mph": storm_data.get("movementSpeed"),
                "pressure_mb": storm_data.get("pressure"),
                "headline": storm_data.get("headline"),
                "is_active": True,
            }
        except (ValueError, TypeError):
            return None
    
    async def fetch_forecast(self, storm_id: str) -> Optional[Dict[str, Any]]:
        """
        Fetch forecast cone and track for a specific storm.
        """
        # NOAA provides GIS data for active storms
        # Format: https://www.nhc.noaa.gov/storm_graphics/{storm_id}_5day_cone.kmz
        cone_url = f"https://www.nhc.noaa.gov/storm_graphics/api/{storm_id}_CONE_latest.json"
        
        try:
            response = await self.client.get(cone_url)
            if response.status_code == 200:
                return response.json()
        except httpx.HTTPError:
            pass
        
        return None
    
    async def fetch_historical_tracks(
        self,
        year: int,
        basin: str = "AL"
    ) -> List[Dict[str, Any]]:
        """
        Fetch historical hurricane tracks from IBTrACS database.
        """
        # IBTrACS provides comprehensive historical data
        # https://www.ncei.noaa.gov/products/international-best-track-archive
        ibtracs_url = f"https://www.ncei.noaa.gov/data/international-best-track-archive-for-climate-stewardship-ibtracs/v04r00/access/json/ibtracs.{basin}.list.v04r00.json"
        
        try:
            response = await self.client.get(ibtracs_url)
            response.raise_for_status()
            
            data = response.json()
            # Filter by year
            storms = [
                s for s in data 
                if str(year) in s.get("season", "")
            ]
            return storms
        except httpx.HTTPError:
            return []
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
