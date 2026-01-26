"""
Severe Weather API endpoints (Tornado, Hail, Flooding).
"""
from datetime import datetime
from typing import Optional, List
from fastapi import APIRouter, Query

from app.services.nws_client import NWSClient

router = APIRouter()


@router.get("/alerts")
async def get_severe_weather_alerts(
    event_type: Optional[str] = Query(None, description="tornado, hail, flooding, thunderstorm"),
    state: Optional[str] = Query(None, description="State code (e.g., TX, CA, FL)"),
    severity: Optional[str] = Query(None, description="Extreme, Severe, Moderate, Minor"),
):
    """
    Get active severe weather alerts from NOAA NWS.
    """
    client = NWSClient()
    
    try:
        event_types = None
        if event_type:
            type_mapping = {
                "tornado": ["Tornado"],
                "hail": ["Hail", "Severe Thunderstorm"],
                "flooding": ["Flood", "Flash Flood"],
                "thunderstorm": ["Severe Thunderstorm", "Thunderstorm"],
            }
            event_types = type_mapping.get(event_type.lower())
        
        alerts = await client.fetch_active_alerts(
            event_types=event_types,
            area=state,
            severity=severity,
        )
        
        # Convert to GeoJSON
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [alert["longitude"], alert["latitude"]]
                },
                "properties": {
                    "source_id": alert.get("source_id"),
                    "event_type": alert.get("event_type"),
                    "raw_event": alert.get("raw_event"),
                    "location": alert.get("location"),
                    "description": alert.get("description"),
                    "severity": alert.get("severity"),
                    "urgency": alert.get("urgency"),
                    "event_time": alert.get("event_time").isoformat() if alert.get("event_time") else None,
                    "expires_at": alert.get("expires_at").isoformat() if alert.get("expires_at") else None,
                }
            }
            for alert in alerts
            if alert.get("latitude") and alert.get("longitude")
        ]
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated": datetime.utcnow().isoformat(),
                "count": len(features),
                "source": "NOAA NWS",
                "filter": {
                    "event_type": event_type,
                    "state": state,
                }
            }
        }
    finally:
        await client.close()


@router.get("/tornadoes")
async def get_tornado_alerts():
    """
    Get active tornado warnings and watches.
    """
    client = NWSClient()
    
    try:
        alerts = await client.fetch_tornado_warnings()
        
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [alert["longitude"], alert["latitude"]]
                },
                "properties": {
                    **{k: v for k, v in alert.items() if k not in ["latitude", "longitude"]},
                    "event_time": alert.get("event_time").isoformat() if alert.get("event_time") else None,
                    "expires_at": alert.get("expires_at").isoformat() if alert.get("expires_at") else None,
                }
            }
            for alert in alerts
            if alert.get("latitude") and alert.get("longitude")
        ]
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated": datetime.utcnow().isoformat(),
                "count": len(features),
                "source": "NOAA NWS",
            }
        }
    finally:
        await client.close()


@router.get("/flooding")
async def get_flood_alerts():
    """
    Get active flood warnings and watches.
    """
    client = NWSClient()
    
    try:
        alerts = await client.fetch_flood_alerts()
        
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [alert["longitude"], alert["latitude"]]
                },
                "properties": {
                    **{k: v for k, v in alert.items() if k not in ["latitude", "longitude"]},
                    "event_time": alert.get("event_time").isoformat() if alert.get("event_time") else None,
                    "expires_at": alert.get("expires_at").isoformat() if alert.get("expires_at") else None,
                }
            }
            for alert in alerts
            if alert.get("latitude") and alert.get("longitude")
        ]
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated": datetime.utcnow().isoformat(),
                "count": len(features),
                "source": "NOAA NWS",
            }
        }
    finally:
        await client.close()


@router.get("/hail")
async def get_hail_reports():
    """
    Get severe thunderstorm alerts (which include hail threats).
    """
    client = NWSClient()
    
    try:
        alerts = await client.fetch_severe_thunderstorm_alerts()
        
        features = [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Point",
                    "coordinates": [alert["longitude"], alert["latitude"]]
                },
                "properties": {
                    **{k: v for k, v in alert.items() if k not in ["latitude", "longitude"]},
                    "event_time": alert.get("event_time").isoformat() if alert.get("event_time") else None,
                    "expires_at": alert.get("expires_at").isoformat() if alert.get("expires_at") else None,
                }
            }
            for alert in alerts
            if alert.get("latitude") and alert.get("longitude")
        ]
        
        return {
            "type": "FeatureCollection",
            "features": features,
            "metadata": {
                "generated": datetime.utcnow().isoformat(),
                "count": len(features),
                "source": "NOAA NWS",
            }
        }
    finally:
        await client.close()


@router.get("/storm-reports")
async def get_storm_reports():
    """
    Get today's storm reports from Storm Prediction Center.
    Includes confirmed tornadoes, hail, and damaging winds.
    """
    client = NWSClient()
    
    try:
        reports = await client.fetch_spc_storm_reports()
        
        all_features = []
        
        for report_type, items in reports.items():
            for report in items:
                all_features.append({
                    "type": "Feature",
                    "geometry": {
                        "type": "Point",
                        "coordinates": [report["longitude"], report["latitude"]]
                    },
                    "properties": {
                        "report_type": report_type,
                        **{k: v for k, v in report.items() if k not in ["latitude", "longitude"]},
                    }
                })
        
        return {
            "type": "FeatureCollection",
            "features": all_features,
            "metadata": {
                "generated": datetime.utcnow().isoformat(),
                "count": len(all_features),
                "source": "NOAA SPC",
                "breakdown": {
                    "tornadoes": len(reports.get("tornadoes", [])),
                    "hail": len(reports.get("hail", [])),
                    "wind": len(reports.get("wind", [])),
                }
            }
        }
    finally:
        await client.close()
