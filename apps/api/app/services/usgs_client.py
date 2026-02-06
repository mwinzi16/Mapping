"""
USGS Earthquake API Client.
https://earthquake.usgs.gov/fdsnws/event/1/
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class USGSClient:
    """Client for fetching earthquake data from USGS."""
    
    BASE_URL = settings.USGS_API_BASE
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=30.0)
    
    async def fetch_earthquakes(
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
        """
        Fetch earthquakes from USGS API.
        
        Returns GeoJSON features.
        """
        params = {
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
        
        response = await self.client.get(f"{self.BASE_URL}/query", params=params)
        response.raise_for_status()
        
        data = response.json()
        return data.get("features", [])
    
    async def fetch_earthquake_by_id(self, event_id: str) -> Optional[Dict[str, Any]]:
        """Fetch a single earthquake by USGS event ID."""
        params = {
            "format": "geojson",
            "eventid": event_id,
        }
        
        try:
            response = await self.client.get(f"{self.BASE_URL}/query", params=params)
            response.raise_for_status()
            data = response.json()
            features = data.get("features", [])
            return features[0] if features else None
        except httpx.HTTPError:
            return None
    
    async def fetch_significant_earthquakes(self, days: int = 30) -> List[Dict[str, Any]]:
        """Fetch significant earthquakes feed."""
        # USGS provides pre-built feeds for common queries
        feed_url = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/significant_month.geojson"
        
        response = await self.client.get(feed_url)
        response.raise_for_status()
        
        data = response.json()
        return data.get("features", [])
    
    async def fetch_recent_earthquakes(
        self,
        hours: int = 1,
        min_magnitude: float = 2.5
    ) -> Dict[str, Any]:
        """
        Fetch recent earthquakes from the last N hours.
        Returns raw GeoJSON response with features.
        """
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)
        
        params = {
            "format": "geojson",
            "starttime": start_time.isoformat(),
            "endtime": end_time.isoformat(),
            "minmagnitude": min_magnitude,
            "orderby": "time",
        }
        
        try:
            response = await self.client.get(f"{self.BASE_URL}/query", params=params)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPError as e:
            logger.error("Error fetching recent earthquakes: %s", e)
            return {"features": []}

    def parse_feature(self, feature: Dict[str, Any]) -> Dict[str, Any]:
        """
        Parse a GeoJSON feature into our internal format.
        """
        props = feature.get("properties", {})
        geometry = feature.get("geometry", {})
        coordinates = geometry.get("coordinates", [0, 0, 0])
        
        return {
            "usgs_id": feature.get("id"),
            "magnitude": props.get("mag"),
            "magnitude_type": props.get("magType"),
            "place": props.get("place"),
            "event_time": datetime.fromtimestamp(props.get("time", 0) / 1000, tz=timezone.utc),
            "updated_at": datetime.fromtimestamp(props.get("updated", 0) / 1000, tz=timezone.utc),
            "longitude": coordinates[0],
            "latitude": coordinates[1],
            "depth_km": coordinates[2],
            "status": props.get("status"),
            "tsunami": props.get("tsunami", 0),
            "significance": props.get("sig", 0),
            "url": props.get("url"),
        }
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()
