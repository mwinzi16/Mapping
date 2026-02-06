"""
Hurricane API endpoints.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.schemas.hurricane import HurricaneList, HurricaneResponse
from app.services.hurricane_service import HurricaneService
from app.services.noaa_client import NOAAClient

router = APIRouter()


@router.get("/", response_model=HurricaneList)
async def list_hurricanes(
    basin: Optional[str] = Query(None, description="Ocean basin (AL, EP, WP)"),
    is_active: Optional[bool] = Query(None),
    min_category: Optional[int] = Query(None, ge=1, le=5),
    page: int = Query(1, ge=1),
    per_page: int = Query(50, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    """
    Get a paginated list of hurricanes with optional filters.
    """
    service = HurricaneService(db)
    return await service.get_hurricanes(
        basin=basin,
        is_active=is_active,
        min_category=min_category,
        page=page,
        per_page=per_page,
    )


@router.get("/active")
async def get_active_storms():
    """
    Get currently active tropical storms and hurricanes from NOAA.
    """
    client = NOAAClient()
    try:
        storms = await client.fetch_active_storms()

        return {
            "storms": storms,
            "count": len(storms),
            "source": "NOAA National Hurricane Center",
        }
    finally:
        await client.close()


@router.get("/season/{year}")
async def get_season_hurricanes(
    year: int,
    basin: Optional[str] = Query("AL", description="Ocean basin"),
    db: AsyncSession = Depends(get_db),
):
    """
    Get all hurricanes from a specific season.
    """
    service = HurricaneService(db)
    hurricanes = await service.get_by_season(year=year, basin=basin)
    
    return {
        "year": year,
        "basin": basin,
        "storms": hurricanes,
        "count": len(hurricanes),
    }


@router.get("/{hurricane_id}", response_model=HurricaneResponse)
async def get_hurricane(
    hurricane_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get a specific hurricane by ID with full track history.
    """
    service = HurricaneService(db)
    hurricane = await service.get_by_id(hurricane_id)
    
    if not hurricane:
        raise HTTPException(status_code=404, detail="Hurricane not found")
    
    return HurricaneResponse.from_orm_with_geometry(hurricane)


@router.get("/{hurricane_id}/track")
async def get_hurricane_track(
    hurricane_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get the full track (path) of a hurricane as GeoJSON.
    """
    service = HurricaneService(db)
    track = await service.get_track(hurricane_id)
    
    if not track:
        raise HTTPException(status_code=404, detail="Hurricane track not found")
    
    return {
        "type": "Feature",
        "geometry": track,
        "properties": {
            "hurricane_id": hurricane_id,
        }
    }


@router.get("/{hurricane_id}/forecast")
async def get_hurricane_forecast(
    hurricane_id: int,
    db: AsyncSession = Depends(get_db),
):
    """
    Get forecast cone and predicted path for active hurricane.
    """
    service = HurricaneService(db)
    hurricane = await service.get_by_id(hurricane_id)
    
    if not hurricane:
        raise HTTPException(status_code=404, detail="Hurricane not found")
    
    if not hurricane.is_active:
        raise HTTPException(status_code=400, detail="Hurricane is no longer active")
    
    # Fetch forecast from NOAA
    client = NOAAClient()
    try:
        forecast = await client.fetch_forecast(hurricane.storm_id)
        return forecast
    finally:
        await client.close()
