"""
Earthquake API endpoints.
"""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.earthquake import EarthquakeList, EarthquakeResponse
from app.services.earthquake_service import EarthquakeService
from app.services.usgs_client import USGSClient

router = APIRouter()


@router.get("/", response_model=EarthquakeList)
async def list_earthquakes(
    min_magnitude: Optional[float] = Query(None, ge=0, le=10),
    max_magnitude: Optional[float] = Query(None, ge=0, le=10),
    start_date: Optional[datetime] = None,
    end_date: Optional[datetime] = None,
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a paginated list of earthquakes with optional filters.
    """
    service = EarthquakeService(db)
    return await service.get_earthquakes(
        min_magnitude=min_magnitude,
        max_magnitude=max_magnitude,
        start_date=start_date,
        end_date=end_date,
        page=page,
        per_page=per_page,
    )


@router.get("/recent")
async def get_recent_earthquakes(
    hours: int = Query(24, ge=1, le=168),
    min_magnitude: float = Query(2.5, ge=0, le=10),
):
    """
    Get recent earthquakes directly from USGS API.
    Useful for real-time updates without database.
    """
    client = USGSClient()
    try:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(hours=hours)

        earthquakes = await client.fetch_earthquakes(
            start_time=start_time,
            end_time=end_time,
            min_magnitude=min_magnitude,
        )

        return {
            "type": "FeatureCollection",
            "features": earthquakes,
            "metadata": {
                "generated": datetime.now(timezone.utc).isoformat(),
                "count": len(earthquakes),
                "parameters": {
                    "hours": hours,
                    "min_magnitude": min_magnitude,
                },
            },
        }
    finally:
        await client.close()


@router.get("/significant")
async def get_significant_earthquakes(
    days: int = Query(30, ge=1, le=365),
):
    """
    Get significant earthquakes (M4.5+) from the past N days.
    """
    client = USGSClient()
    try:
        end_time = datetime.now(timezone.utc)
        start_time = end_time - timedelta(days=days)

        earthquakes = await client.fetch_earthquakes(
            start_time=start_time,
            end_time=end_time,
            min_magnitude=4.5,
        )

        return {
            "type": "FeatureCollection",
            "features": earthquakes,
            "metadata": {
                "generated": datetime.now(timezone.utc).isoformat(),
                "count": len(earthquakes),
            },
        }
    finally:
        await client.close()


@router.get("/{earthquake_id}", response_model=EarthquakeResponse)
async def get_earthquake(
    earthquake_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific earthquake by ID.
    """
    service = EarthquakeService(db)
    earthquake = await service.get_by_id(earthquake_id)

    if not earthquake:
        raise HTTPException(status_code=404, detail="Earthquake not found")

    return EarthquakeResponse.from_orm_with_geometry(earthquake)


@router.get("/usgs/{usgs_id}")
async def get_earthquake_by_usgs_id(usgs_id: str):
    """
    Get earthquake details directly from USGS by their ID.
    """
    client = USGSClient()
    try:
        earthquake = await client.fetch_earthquake_by_id(usgs_id)

        if not earthquake:
            raise HTTPException(status_code=404, detail="Earthquake not found")

        return earthquake
    finally:
        await client.close()
