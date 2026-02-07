"""
NOAA National Weather Service API Client.
https://www.weather.gov/documentation/services-web-api

For severe weather: tornadoes, hail, flooding, severe thunderstorms
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

import httpx

from app.core.config import settings

logger = logging.getLogger(__name__)


class NWSClient:
    """Client for fetching severe weather data from NOAA NWS."""
    
    # NWS API base
    NWS_API = "https://api.weather.gov"
    
    # Storm Prediction Center for severe weather reports
    SPC_BASE = "https://www.spc.noaa.gov/climo/reports"
    
    def __init__(self):
        self.client = httpx.AsyncClient(
            timeout=30.0,
            headers={
                "User-Agent": "CatastropheMapping/1.0 (contact@example.com)",
                "Accept": "application/geo+json",
            }
        )
    
    async def fetch_active_alerts(
        self,
        event_types: Optional[List[str]] = None,
        area: Optional[str] = None,  # State code like "CA", "TX"
        urgency: Optional[str] = None,  # Immediate, Expected, Future
        severity: Optional[str] = None,  # Extreme, Severe, Moderate, Minor
    ) -> List[Dict[str, Any]]:
        """
        Fetch active weather alerts from NWS.
        
        Event types include: Tornado Warning, Flood Warning, 
        Severe Thunderstorm Warning, Flash Flood Warning, etc.
        """
        params = {"status": "actual"}
        
        if area:
            params["area"] = area
        if urgency:
            params["urgency"] = urgency
        if severity:
            params["severity"] = severity
        
        try:
            response = await self.client.get(f"{self.NWS_API}/alerts/active", params=params)
            response.raise_for_status()
            
            data = response.json()
            alerts = []
            
            for feature in data.get("features", []):
                props = feature.get("properties", {})
                event = props.get("event", "")
                
                # Filter by event type if specified
                if event_types:
                    event_lower = event.lower()
                    if not any(et.lower() in event_lower for et in event_types):
                        continue
                
                alert = self._parse_alert(feature)
                if alert:
                    alerts.append(alert)
            
            return alerts
        except httpx.HTTPError as e:
            logger.error("Error fetching NWS alerts: %s", e)
            return []
    
    async def fetch_tornado_warnings(self) -> List[Dict[str, Any]]:
        """Fetch active tornado warnings."""
        return await self.fetch_active_alerts(
            event_types=["Tornado Warning", "Tornado Watch", "Tornado"]
        )
    
    async def fetch_flood_alerts(self) -> List[Dict[str, Any]]:
        """Fetch flood-related alerts."""
        return await self.fetch_active_alerts(
            event_types=["Flood", "Flash Flood", "River Flood", "Coastal Flood"]
        )
    
    async def fetch_severe_thunderstorm_alerts(self) -> List[Dict[str, Any]]:
        """Fetch severe thunderstorm alerts (includes hail)."""
        return await self.fetch_active_alerts(
            event_types=["Severe Thunderstorm", "Hail"]
        )
    
    async def fetch_spc_storm_reports(
        self,
        date: Optional[datetime] = None
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        Fetch storm reports from Storm Prediction Center.
        Includes: tornadoes, hail, and damaging winds.
        
        Returns dict with keys: tornadoes, hail, wind
        """
        if date is None:
            date = datetime.now(timezone.utc)
        
        # SPC uses YYMMDD format
        date_str = date.strftime("%y%m%d")
        
        results = {
            "tornadoes": [],
            "hail": [],
            "wind": [],
        }
        
        # Fetch each report type
        for report_type in ["torn", "hail", "wind"]:
            url = f"{self.SPC_BASE}/{date_str}_rpts_{report_type}.csv"
            
            try:
                response = await self.client.get(url)
                if response.status_code == 200:
                    reports = self._parse_spc_csv(response.text, report_type)
                    key = "tornadoes" if report_type == "torn" else report_type
                    results[key] = reports
            except httpx.HTTPError:
                continue
        
        return results
    
    def _parse_alert(self, feature: Dict) -> Optional[Dict[str, Any]]:
        """Parse a NWS alert feature into our format."""
        props = feature.get("properties", {})
        geometry = feature.get("geometry")
        
        # Get centroid from geometry
        lat, lon = self._get_geometry_centroid(geometry)
        
        if lat is None or lon is None:
            return None
        
        event = props.get("event", "")
        event_type = self._classify_event(event)
        
        return {
            "source_id": props.get("id", ""),
            "event_type": event_type,
            "latitude": lat,
            "longitude": lon,
            "location": props.get("areaDesc", ""),
            "description": props.get("headline", ""),
            "source": "NWS",
            "event_time": self._parse_iso_datetime(props.get("onset") or props.get("effective")),
            "expires_at": self._parse_iso_datetime(props.get("expires")),
            "severity": props.get("severity"),
            "urgency": props.get("urgency"),
            "certainty": props.get("certainty"),
            "raw_event": event,
        }
    
    def _classify_event(self, event: str) -> str:
        """Classify NWS event into our event types."""
        event_lower = event.lower()
        
        if "tornado" in event_lower:
            return "tornado"
        elif "hail" in event_lower:
            return "hail"
        elif "flood" in event_lower:
            return "flooding"
        elif "thunderstorm" in event_lower:
            return "thunderstorm"
        elif "wind" in event_lower:
            return "wind"
        else:
            return "thunderstorm"  # Default
    
    def _get_geometry_centroid(self, geometry: Optional[Dict]) -> tuple:
        """Extract centroid from GeoJSON geometry."""
        if not geometry:
            return None, None
        
        geom_type = geometry.get("type", "")
        coords = geometry.get("coordinates", [])
        
        if geom_type == "Point":
            return (coords[1], coords[0]) if len(coords) >= 2 else (None, None)
        elif geom_type == "Polygon" and coords:
            # Get centroid of first ring
            ring = coords[0]
            if ring:
                avg_lon = sum(c[0] for c in ring) / len(ring)
                avg_lat = sum(c[1] for c in ring) / len(ring)
                return avg_lat, avg_lon
        elif geom_type == "MultiPolygon" and coords:
            # Get centroid of first polygon
            first_poly = coords[0]
            if first_poly and first_poly[0]:
                ring = first_poly[0]
                avg_lon = sum(c[0] for c in ring) / len(ring)
                avg_lat = sum(c[1] for c in ring) / len(ring)
                return avg_lat, avg_lon
        
        return None, None
    
    def _parse_spc_csv(self, csv_text: str, report_type: str) -> List[Dict[str, Any]]:
        """Parse SPC storm report CSV."""
        reports = []
        lines = csv_text.strip().split('\n')
        
        if len(lines) < 2:
            return reports
        
        # SPC CSV format varies, but generally:
        # Time,F_Scale,Location,County,State,Lat,Lon,Comments
        for line in lines[1:]:
            try:
                parts = line.split(',')
                if len(parts) < 7:
                    continue
                
                report = {
                    "source_id": f"SPC_{report_type}_{parts[5]}_{parts[6]}_{parts[0]}",
                    "event_type": "tornado" if report_type == "torn" else report_type,
                    "latitude": float(parts[5]),
                    "longitude": float(parts[6]),
                    "location": parts[2] if len(parts) > 2 else "",
                    "county": parts[3] if len(parts) > 3 else "",
                    "state": parts[4] if len(parts) > 4 else "",
                    "source": "SPC",
                    "event_time": datetime.now(timezone.utc),  # Simplified
                }
                
                # Add type-specific data
                if report_type == "torn" and len(parts) > 1:
                    try:
                        report["tornado_scale"] = int(parts[1].replace("EF", "").replace("F", ""))
                    except ValueError:
                        pass
                elif report_type == "hail" and len(parts) > 1:
                    try:
                        report["hail_size_inches"] = float(parts[1]) / 100  # Often in hundredths
                    except ValueError:
                        pass
                elif report_type == "wind" and len(parts) > 1:
                    try:
                        report["wind_speed_mph"] = int(parts[1])
                    except ValueError:
                        pass
                
                reports.append(report)
            except (ValueError, IndexError):
                continue
        
        return reports
    
    def _parse_iso_datetime(self, dt_str: Optional[str]) -> Optional[datetime]:
        """Parse ISO datetime string."""
        if not dt_str:
            return None
        try:
            # Handle various ISO formats
            dt_str = dt_str.replace('Z', '+00:00')
            return datetime.fromisoformat(dt_str)
        except ValueError:
            return None
    
    async def close(self):
        await self.client.aclose()
