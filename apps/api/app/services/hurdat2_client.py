"""
NOAA HURDAT2 (Hurricane Database) Client.
Atlantic hurricane database from 1851-present.
https://www.nhc.noaa.gov/data/hurdat/
"""
from datetime import datetime
from typing import Optional, List, Dict, Any
import httpx
import re


class HURDAT2Client:
    """Client for fetching historical hurricane data from NOAA HURDAT2."""
    
    # HURDAT2 Atlantic basin data
    HURDAT2_ATLANTIC_URL = "https://www.nhc.noaa.gov/data/hurdat/hurdat2-1851-2023-051124.txt"
    
    # HURDAT2 Pacific basin data  
    HURDAT2_PACIFIC_URL = "https://www.nhc.noaa.gov/data/hurdat/hurdat2-nepac-1949-2023-042624.txt"
    
    def __init__(self):
        self.client = httpx.AsyncClient(timeout=120.0)
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
        # Determine which dataset to use based on basin parameter
        # Accept both standard codes (EP, CP) and descriptive names (pacific, atlantic)
        pacific_basins = ["EP", "CP", "pacific", "nepac"]
        if basin and basin.lower() in [b.lower() for b in pacific_basins]:
            url = self.HURDAT2_PACIFIC_URL
            cache_key = "hurdat2_pacific"
        else:
            url = self.HURDAT2_ATLANTIC_URL
            cache_key = "hurdat2_atlantic"
        
        # Check cache
        if cache_key not in self._cache:
            raw_data = await self._fetch_and_parse(url)
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
    
    async def _fetch_and_parse(self, url: str) -> List[Dict[str, Any]]:
        """Fetch and parse HURDAT2 data."""
        try:
            response = await self.client.get(url)
            response.raise_for_status()
            return self._parse_hurdat2(response.text)
        except httpx.HTTPError as e:
            print(f"Error fetching HURDAT2 data: {e}")
            return []
    
    def _parse_hurdat2(self, text: str) -> List[Dict[str, Any]]:
        """
        Parse HURDAT2 format into structured hurricane data.
        
        HURDAT2 format:
        Header line: AL092023,                IDALIA,     40,
        Track lines: 20230826, 1800,  , TD, 18.3N,  84.9W,  30, 1005, ...
        """
        hurricanes = []
        lines = text.strip().split('\n')
        
        i = 0
        while i < len(lines):
            line = lines[i].strip()
            
            # Check if this is a header line (contains storm ID)
            if ',' in line and len(line.split(',')[0].strip()) == 8:
                # Parse header
                parts = [p.strip() for p in line.split(',')]
                storm_id = parts[0]
                name = parts[1].strip() if len(parts) > 1 else "UNNAMED"
                num_entries = int(parts[2]) if len(parts) > 2 and parts[2].strip() else 0
                
                # Extract year from storm ID (e.g., AL092023 -> 2023)
                year_match = re.search(r'(\d{4})$', storm_id)
                year = int(year_match.group(1)) if year_match else 0
                
                # Determine basin from storm ID
                basin = storm_id[:2] if len(storm_id) >= 2 else "AL"
                
                # Parse track entries
                track = []
                max_wind = 0
                min_pressure = None
                max_category = 0
                start_date = None
                end_date = None
                
                for j in range(num_entries):
                    i += 1
                    if i >= len(lines):
                        break
                    
                    track_line = lines[i].strip()
                    track_point = self._parse_track_line(track_line)
                    
                    if track_point:
                        track.append(track_point)
                        
                        # Track max wind
                        wind = track_point.get("wind_knots", 0)
                        if wind > max_wind:
                            max_wind = wind
                            max_category = self._wind_to_category(wind)
                        
                        # Track min pressure
                        pressure = track_point.get("pressure_mb")
                        if pressure and pressure > 0:
                            if min_pressure is None or pressure < min_pressure:
                                min_pressure = pressure
                        
                        # Track dates
                        ts = track_point.get("timestamp")
                        if ts:
                            if start_date is None:
                                start_date = ts
                            end_date = ts
                
                if track:
                    hurricanes.append({
                        "storm_id": storm_id,
                        "name": name if name != "UNNAMED" else f"UNNAMED_{storm_id}",
                        "year": year,
                        "basin": basin,
                        "max_category": max_category,
                        "max_wind_knots": max_wind,
                        "min_pressure_mb": min_pressure,
                        "track": track,
                        "start_date": start_date,
                        "end_date": end_date,
                    })
            
            i += 1
        
        return hurricanes
    
    def _parse_track_line(self, line: str) -> Optional[Dict[str, Any]]:
        """Parse a single HURDAT2 track line."""
        try:
            parts = [p.strip() for p in line.split(',')]
            if len(parts) < 8:
                return None
            
            # Parse date and time
            date_str = parts[0]  # YYYYMMDD
            time_str = parts[1]  # HHMM
            
            year = int(date_str[:4])
            month = int(date_str[4:6])
            day = int(date_str[6:8])
            hour = int(time_str[:2]) if time_str else 0
            minute = int(time_str[2:4]) if len(time_str) > 2 else 0
            
            timestamp = datetime(year, month, day, hour, minute)
            
            # Parse record identifier and status
            record_id = parts[2]  # L=landfall, etc.
            status = parts[3]  # HU, TS, TD, EX, etc.
            
            # Parse latitude (e.g., "18.3N")
            lat_str = parts[4]
            lat = float(lat_str[:-1])
            if lat_str.endswith('S'):
                lat = -lat
            
            # Parse longitude (e.g., "84.9W")
            lon_str = parts[5]
            lon = float(lon_str[:-1])
            if lon_str.endswith('W'):
                lon = -lon
            
            # Parse max wind (knots) and min pressure (mb)
            wind_knots = int(parts[6]) if parts[6] and parts[6] != '-999' else 0
            pressure_mb = int(parts[7]) if parts[7] and parts[7] != '-999' else None
            
            return {
                "timestamp": timestamp.isoformat(),
                "latitude": lat,
                "longitude": lon,
                "wind_knots": wind_knots,
                "pressure_mb": pressure_mb if pressure_mb and pressure_mb > 0 else None,
                "category": self._wind_to_category(wind_knots),
                "status": status,
                "record_id": record_id,
            }
        except (ValueError, IndexError) as e:
            return None
    
    @staticmethod
    def _wind_to_category(wind_knots: int) -> int:
        """Convert wind speed in knots to Saffir-Simpson category."""
        if wind_knots >= 137:
            return 5
        elif wind_knots >= 113:
            return 4
        elif wind_knots >= 96:
            return 3
        elif wind_knots >= 83:
            return 2
        elif wind_knots >= 64:
            return 1
        else:
            return 0  # Tropical Storm or lower
    
    def get_available_basins(self) -> List[str]:
        """Return list of available ocean basins."""
        return ["AL", "EP", "CP"]  # Atlantic, Eastern Pacific, Central Pacific
    
    async def get_year_range(self, basin: Optional[str] = None) -> tuple:
        """Get the year range of available data."""
        if basin in ["EP", "CP"]:
            return (1949, datetime.now().year)
        return (1851, datetime.now().year)
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Singleton instance
_client: Optional[HURDAT2Client] = None


def get_hurdat2_client() -> HURDAT2Client:
    """Get or create the HURDAT2 client singleton."""
    global _client
    if _client is None:
        _client = HURDAT2Client()
    return _client
