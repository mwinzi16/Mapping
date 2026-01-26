"""
Real-time event service.
Polls APIs for new events and broadcasts via WebSocket + sends email alerts.
"""
import asyncio
from datetime import datetime, timedelta
from typing import Dict, Set, List, Any
import json

from app.services.usgs_client import USGSClient
from app.services.noaa_client import NOAAClient
from app.services.nasa_firms_client import NASAFirmsClient
from app.services.nws_client import NWSClient
from app.services.email_service import email_service
from app.routers.notifications import manager as ws_manager


def json_serializer(obj):
    """Custom JSON serializer for objects not serializable by default json code."""
    if isinstance(obj, datetime):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serializable")


class RealtimeService:
    """Service for real-time event monitoring and notifications."""
    
    def __init__(self):
        self.usgs = USGSClient()
        self.noaa = NOAAClient()
        self.firms = NASAFirmsClient()
        self.nws = NWSClient()
        
        # Track seen events to avoid duplicates
        self.seen_earthquakes: Set[str] = set()
        self.seen_hurricanes: Set[str] = set()
        self.seen_wildfires: Set[str] = set()
        self.seen_severe: Set[str] = set()
        
        # Running state
        self._running = False
        self._task = None
    
    async def start(self):
        """Start the real-time monitoring loop."""
        if self._running:
            return
        
        self._running = True
        self._task = asyncio.create_task(self._monitor_loop())
        print("🔄 Real-time monitoring started")
    
    async def stop(self):
        """Stop the monitoring loop."""
        self._running = False
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        print("⏹️ Real-time monitoring stopped")
    
    async def _monitor_loop(self):
        """Main monitoring loop - runs continuously."""
        while self._running:
            try:
                await self._check_all_sources()
            except Exception as e:
                print(f"Error in monitor loop: {e}")
            
            # Wait 60 seconds before next check
            await asyncio.sleep(60)
    
    async def _check_all_sources(self):
        """Check all data sources for new events."""
        new_events = []
        
        # Check earthquakes
        eq_events = await self._check_earthquakes()
        new_events.extend(eq_events)
        
        # Check hurricanes
        hurricane_events = await self._check_hurricanes()
        new_events.extend(hurricane_events)
        
        # Check wildfires
        fire_events = await self._check_wildfires()
        new_events.extend(fire_events)
        
        # Check severe weather
        severe_events = await self._check_severe_weather()
        new_events.extend(severe_events)
        
        # Broadcast new events via WebSocket
        if new_events:
            await self._broadcast_events(new_events)
            await self._send_email_alerts(new_events)
    
    async def _check_earthquakes(self) -> List[Dict[str, Any]]:
        """Check for new earthquakes."""
        new_events = []
        
        try:
            # Fetch recent earthquakes (last 1 hour, M2.5+)
            data = await self.usgs.fetch_recent_earthquakes(hours=1, min_magnitude=2.5)
            
            for feature in data.get("features", []):
                eq_id = feature.get("id")
                if eq_id and eq_id not in self.seen_earthquakes:
                    self.seen_earthquakes.add(eq_id)
                    
                    props = feature.get("properties", {})
                    coords = feature.get("geometry", {}).get("coordinates", [0, 0, 0])
                    
                    event = {
                        "type": "earthquake",
                        "id": eq_id,
                        "magnitude": props.get("mag"),
                        "place": props.get("place"),
                        "event_time": datetime.fromtimestamp(
                            props.get("time", 0) / 1000
                        ).isoformat(),
                        "latitude": coords[1],
                        "longitude": coords[0],
                        "depth_km": coords[2],
                    }
                    new_events.append(event)
                    
                    # Only keep last 1000 IDs
                    if len(self.seen_earthquakes) > 1000:
                        self.seen_earthquakes = set(list(self.seen_earthquakes)[-500:])
        except Exception as e:
            print(f"Error checking earthquakes: {e}")
        
        return new_events
    
    async def _check_hurricanes(self) -> List[Dict[str, Any]]:
        """Check for new/updated hurricanes."""
        new_events = []
        
        try:
            storms = await self.noaa.fetch_active_storms()
            
            for storm in storms:
                storm_id = storm.get("id") or storm.get("name")
                # For hurricanes, we might want to notify on updates too
                if storm_id and storm_id not in self.seen_hurricanes:
                    self.seen_hurricanes.add(storm_id)
                    
                    event = {
                        "type": "hurricane",
                        **storm,
                    }
                    new_events.append(event)
        except Exception as e:
            print(f"Error checking hurricanes: {e}")
        
        return new_events
    
    async def _check_wildfires(self) -> List[Dict[str, Any]]:
        """Check for new wildfires."""
        new_events = []
        
        try:
            fires = await self.firms.fetch_active_fires_usa(days=1)
            
            for fire in fires[:50]:  # Limit to 50 most recent
                fire_id = fire.get("source_id")
                if fire_id and fire_id not in self.seen_wildfires:
                    self.seen_wildfires.add(fire_id)
                    
                    event = {
                        "type": "wildfire",
                        **fire,
                    }
                    new_events.append(event)
                    
                    if len(self.seen_wildfires) > 500:
                        self.seen_wildfires = set(list(self.seen_wildfires)[-250:])
        except Exception as e:
            print(f"Error checking wildfires: {e}")
        
        return new_events
    
    async def _check_severe_weather(self) -> List[Dict[str, Any]]:
        """Check for new severe weather alerts."""
        new_events = []
        
        try:
            alerts = await self.nws.fetch_active_alerts(
                event_types=["Tornado", "Flood", "Hail", "Severe Thunderstorm"]
            )
            
            for alert in alerts:
                alert_id = alert.get("source_id")
                if alert_id and alert_id not in self.seen_severe:
                    self.seen_severe.add(alert_id)
                    
                    event = {
                        "type": alert.get("event_type", "severe"),
                        **alert,
                    }
                    new_events.append(event)
                    
                    if len(self.seen_severe) > 500:
                        self.seen_severe = set(list(self.seen_severe)[-250:])
        except Exception as e:
            print(f"Error checking severe weather: {e}")
        
        return new_events
    
    async def _broadcast_events(self, events: List[Dict[str, Any]]):
        """Broadcast events to all connected WebSocket clients."""
        for event in events:
            message = {
                "type": "new_event",
                "event_type": event.get("type"),
                "data": event,
                "timestamp": datetime.utcnow().isoformat(),
            }
            await ws_manager.broadcast(json.dumps(message, default=json_serializer))
            print(f"📡 Broadcast: {event.get('type')} event")
    
    async def _send_email_alerts(self, events: List[Dict[str, Any]]):
        """Send email alerts to matching subscribers."""
        # Import here to avoid circular imports
        from app.routers.subscriptions import get_active_subscriptions
        
        subscribers = get_active_subscriptions()
        
        for subscriber in subscribers:
            matching_events = []
            
            for event in events:
                if self._event_matches_subscription(event, subscriber):
                    matching_events.append(event)
            
            if matching_events:
                # Check rate limit
                if subscriber.get("emails_sent_today", 0) >= subscriber.get("max_emails_per_day", 10):
                    continue
                
                try:
                    await email_service.send_alert_email(
                        subscriber["email"],
                        matching_events,
                        subscriber.get("unsubscribe_token", "")
                    )
                    subscriber["emails_sent_today"] = subscriber.get("emails_sent_today", 0) + 1
                    print(f"📧 Alert sent to {subscriber['email']}")
                except Exception as e:
                    print(f"Error sending alert to {subscriber['email']}: {e}")
    
    def _event_matches_subscription(self, event: Dict, sub: Dict) -> bool:
        """Check if an event matches a subscriber's preferences."""
        event_type = event.get("type")
        
        # Check event type preferences
        type_map = {
            "earthquake": "alert_earthquakes",
            "hurricane": "alert_hurricanes",
            "wildfire": "alert_wildfires",
            "tornado": "alert_tornadoes",
            "flooding": "alert_flooding",
            "hail": "alert_hail",
        }
        
        pref_key = type_map.get(event_type)
        if pref_key and not sub.get(pref_key, True):
            return False
        
        # Check magnitude threshold for earthquakes
        if event_type == "earthquake":
            min_mag = sub.get("min_earthquake_magnitude", 5.0)
            if event.get("magnitude", 0) < min_mag:
                return False
        
        # Check category threshold for hurricanes
        if event_type == "hurricane":
            min_cat = sub.get("min_hurricane_category", 1)
            event_cat = event.get("category") or 0
            if event_cat < min_cat:
                return False
        
        # Check location filter
        location_filter = sub.get("location_filter")
        if location_filter:
            from math import radians, cos, sin, asin, sqrt
            
            def haversine(lat1, lon1, lat2, lon2):
                lat1, lon1, lat2, lon2 = map(radians, [lat1, lon1, lat2, lon2])
                dlat = lat2 - lat1
                dlon = lon2 - lon1
                a = sin(dlat/2)**2 + cos(lat1) * cos(lat2) * sin(dlon/2)**2
                return 2 * 6371 * asin(sqrt(a))  # km
            
            event_lat = event.get("latitude")
            event_lon = event.get("longitude")
            
            if event_lat and event_lon:
                distance = haversine(
                    location_filter.get("latitude", 0),
                    location_filter.get("longitude", 0),
                    event_lat,
                    event_lon
                )
                if distance > location_filter.get("radius_km", 500):
                    return False
        
        return True


# Singleton instance
realtime_service = RealtimeService()
