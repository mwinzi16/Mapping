"""
Wildfire API endpoints.
"""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from app.core.clients import get_firms_client
from app.core.response import success_response

router = APIRouter()


@router.get("/active")
async def get_active_wildfires(
    region: Optional[str] = Query("USA", description="Region: USA, Global"),
    hours: int = Query(24, ge=1, le=168),
):
    """
    Get currently active wildfires.
    Data from NASA FIRMS (Fire Information for Resource Management System).
    """
    client = get_firms_client()

    if region.upper() == "USA":
        fires = await client.fetch_active_fires_usa(days=max(1, hours // 24))
    else:
        fires = await client.fetch_global_fires(hours=hours)

    # Convert to GeoJSON
    features = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [fire["longitude"], fire["latitude"]]
            },
            "properties": {
                "source_id": fire.get("source_id"),
                "brightness": fire.get("brightness"),
                "frp": fire.get("frp"),
                "confidence": fire.get("confidence"),
                "satellite": fire.get("satellite"),
                "detected_at": fire.get("detected_at").isoformat() if fire.get("detected_at") else None,
            }
        }
        for fire in fires
    ]

    return {
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(features),
            "source": "NASA FIRMS",
            "region": region,
        }
    }


@router.get("/major")
async def get_major_wildfires():
    """
    Get major/named wildfires with containment info.
    """
    # In a full implementation, this would query NIFC (National Interagency Fire Center)
    # or InciWeb for named incidents with acreage and containment data
    
    return success_response(
        [],
        meta={
            "count": 0,
            "source": "NIFC/InciWeb",
            "note": "Major wildfire tracking requires NIFC data integration",
        },
    )
