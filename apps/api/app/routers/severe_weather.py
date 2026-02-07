"""Severe Weather API endpoints (Tornado, Hail, Flooding)."""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Query

from app.core.clients import get_nws_client
from app.core.response import success_response
from app.utils.geojson import alerts_to_feature_collection, storm_reports_to_feature_collection

router = APIRouter()


@router.get("/alerts")
async def get_severe_weather_alerts(
    event_type: Optional[str] = Query(None, description="tornado, hail, flooding, thunderstorm"),
    state: Optional[str] = Query(None, description="State code (e.g., TX, CA, FL)"),
    severity: Optional[str] = Query(None, description="Extreme, Severe, Moderate, Minor"),
):
    """Get active severe weather alerts from NOAA NWS."""
    client = get_nws_client()

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

    return success_response(alerts_to_feature_collection(
        alerts,
        extra_metadata={"filter": {"event_type": event_type, "state": state}},
    ))


@router.get("/tornadoes")
async def get_tornado_alerts():
    """Get active tornado warnings and watches."""
    client = get_nws_client()
    alerts = await client.fetch_tornado_warnings()
    return success_response(alerts_to_feature_collection(alerts))


@router.get("/flooding")
async def get_flood_alerts():
    """Get active flood warnings and watches."""
    client = get_nws_client()
    alerts = await client.fetch_flood_alerts()
    return success_response(alerts_to_feature_collection(alerts))


@router.get("/hail")
async def get_hail_reports():
    """Get severe thunderstorm alerts (which include hail threats)."""
    client = get_nws_client()
    alerts = await client.fetch_severe_thunderstorm_alerts()
    return success_response(alerts_to_feature_collection(alerts))


@router.get("/storm-reports")
async def get_storm_reports():
    """Get today's storm reports from Storm Prediction Center.

    Includes confirmed tornadoes, hail, and damaging winds.
    """
    client = get_nws_client()
    reports = await client.fetch_spc_storm_reports()
    return success_response(storm_reports_to_feature_collection(reports))
