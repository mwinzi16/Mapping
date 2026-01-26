"""
NASA FIRMS (Fire Information for Resource Management System) API Client.
https://firms.modaps.eosdis.nasa.gov/api/
"""
from datetime import datetime, timedelta
from typing import Optional, List, Dict, Any
import httpx

from app.core.config import settings


class NASAFirmsClient:
    """Client for fetching active fire data from NASA FIRMS."""
    
    # FIRMS provides CSV/JSON feeds for active fires
    # For real-time data, we use the open data feeds
    FIRMS_BASE = "https://firms.modaps.eosdis.nasa.gov/api"
    
    # Alternative: Use FIRMS open data (no API key needed for basic access)
    VIIRS_FEED = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/viirs-snpp/csv"
    MODIS_FEED = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis/csv"
    
    def __init__(self, api_key: Optional[str] = None):
        self.api_key = api_key or getattr(settings, 'NASA_FIRMS_API_KEY', None)
        self.client = httpx.AsyncClient(timeout=60.0)
    
    async def fetch_active_fires_usa(
        self,
        days: int = 1,
        source: str = "VIIRS_SNPP_NRT"
    ) -> List[Dict[str, Any]]:
        """
        Fetch active fires in the USA from the last N days.
        
        Sources: VIIRS_SNPP_NRT, VIIRS_NOAA20_NRT, MODIS_NRT
        """
        # Use the area endpoint for USA
        if self.api_key:
            url = f"{self.FIRMS_BASE}/area/csv/{self.api_key}/{source}/USA/{days}"
        else:
            # Fallback to sample data structure
            return await self._fetch_sample_fires()
        
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            
            # Parse CSV response
            fires = self._parse_csv_response(response.text, source)
            return fires
        except httpx.HTTPError as e:
            print(f"Error fetching FIRMS data: {e}")
            return await self._fetch_sample_fires()
    
    async def fetch_global_fires(
        self,
        hours: int = 24,
    ) -> List[Dict[str, Any]]:
        """
        Fetch global active fires.
        Uses publicly available GeoJSON feeds when possible.
        """
        # FIRMS provides GeoJSON feeds for recent fires
        # This is a simplified endpoint - real implementation would use proper API
        geojson_url = "https://firms.modaps.eosdis.nasa.gov/api/viirs_nrt/geojson/Global/24h"
        
        try:
            response = await self.client.get(geojson_url)
            if response.status_code == 200:
                data = response.json()
                return self._parse_geojson_fires(data)
        except Exception:
            pass
        
        return await self._fetch_sample_fires()
    
    def _parse_csv_response(self, csv_text: str, source: str) -> List[Dict[str, Any]]:
        """Parse CSV response from FIRMS."""
        fires = []
        lines = csv_text.strip().split('\n')
        
        if len(lines) < 2:
            return fires
        
        headers = lines[0].split(',')
        
        for line in lines[1:]:
            values = line.split(',')
            if len(values) != len(headers):
                continue
            
            row = dict(zip(headers, values))
            
            try:
                fire = {
                    "source_id": f"FIRMS_{row.get('acq_date', '')}_{row.get('latitude', '')}_{row.get('longitude', '')}",
                    "latitude": float(row.get('latitude', 0)),
                    "longitude": float(row.get('longitude', 0)),
                    "brightness": float(row.get('bright_ti4', 0) or row.get('brightness', 0)),
                    "frp": float(row.get('frp', 0)) if row.get('frp') else None,
                    "confidence": self._parse_confidence(row.get('confidence', '')),
                    "satellite": source.split('_')[0],
                    "source": "NASA FIRMS",
                    "detected_at": self._parse_datetime(row.get('acq_date', ''), row.get('acq_time', '')),
                }
                fires.append(fire)
            except (ValueError, KeyError):
                continue
        
        return fires
    
    def _parse_geojson_fires(self, geojson: Dict) -> List[Dict[str, Any]]:
        """Parse GeoJSON response."""
        fires = []
        features = geojson.get('features', [])
        
        for feature in features:
            props = feature.get('properties', {})
            coords = feature.get('geometry', {}).get('coordinates', [0, 0])
            
            fires.append({
                "source_id": f"FIRMS_{props.get('acq_date', '')}_{coords[1]}_{coords[0]}",
                "latitude": coords[1],
                "longitude": coords[0],
                "brightness": props.get('bright_ti4') or props.get('brightness'),
                "frp": props.get('frp'),
                "confidence": self._parse_confidence(props.get('confidence', '')),
                "satellite": props.get('satellite', 'VIIRS'),
                "source": "NASA FIRMS",
                "detected_at": datetime.utcnow(),  # Simplified
            })
        
        return fires
    
    def _parse_confidence(self, confidence: str) -> int:
        """Convert confidence to numeric value."""
        if isinstance(confidence, (int, float)):
            return int(confidence)
        conf_map = {'l': 30, 'n': 50, 'h': 80, 'low': 30, 'nominal': 50, 'high': 80}
        return conf_map.get(str(confidence).lower(), 50)
    
    def _parse_datetime(self, date_str: str, time_str: str) -> datetime:
        """Parse FIRMS date and time strings."""
        try:
            # Format: 2024-01-22 and 1234 (HHMM)
            time_str = time_str.zfill(4)
            dt_str = f"{date_str} {time_str[:2]}:{time_str[2:]}"
            return datetime.strptime(dt_str, "%Y-%m-%d %H:%M")
        except ValueError:
            return datetime.utcnow()
    
    async def _fetch_sample_fires(self) -> List[Dict[str, Any]]:
        """Return sample fire data for testing when API is unavailable."""
        # In production, this would return empty or cached data
        return []
    
    async def close(self):
        await self.client.aclose()
