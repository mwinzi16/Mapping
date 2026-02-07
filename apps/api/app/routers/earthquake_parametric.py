"""
API endpoints for earthquake parametric insurance analysis.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.auth import get_api_key
from app.core.rate_limit import limiter
from app.core.response import success_response
from app.schemas.earthquake_parametric import (
    EarthquakeAnalysisRequest,
    EarthquakeBoxStatistics,
    EarthquakeBulkAnalysisRequest,
    EarthquakeDatasetInfo,
    EarthquakeDatasetType,
)
from app.services.earthquake_parametric_service import get_earthquake_parametric_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/earthquake-parametric", tags=["earthquake-parametric"])


@router.get("/datasets", response_model=List[EarthquakeDatasetInfo])
async def get_available_datasets():
    """
    Get list of available earthquake datasets.
    
    Returns dataset metadata including name, description, coverage, and year range.
    """
    service = get_earthquake_parametric_service()
    return success_response(service.get_available_datasets())


@router.get("/earthquakes/historical", response_model=List[dict])
async def get_historical_earthquakes(
    start_year: int = Query(1980, ge=1900, le=2030),
    end_year: int = Query(2024, ge=1900, le=2030),
    min_magnitude: float = Query(4.0, ge=0, le=10),
    dataset: EarthquakeDatasetType = Query(EarthquakeDatasetType.USGS_WORLDWIDE),
):
    """
    Fetch historical earthquake data with optional filters.
    
    Returns earthquakes for visualization and analysis.
    Default minimum magnitude is 4.0 to avoid overwhelming data volumes.
    """
    service = get_earthquake_parametric_service()
    try:
        earthquakes = await service.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=dataset,
        )
        return success_response(earthquakes)
    except Exception:
        logger.exception("Failed to fetch historical earthquakes")
        raise HTTPException(
            status_code=502,
            detail={"code": "EXTERNAL_SERVICE_ERROR", "message": "Data source temporarily unavailable", "details": None},
        )


@router.post("/analysis/earthquakes", response_model=List[dict])
@limiter.limit("30/minute")
async def get_earthquakes_in_box(request: Request, analysis: EarthquakeAnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Get all earthquakes that fall within a bounding box.
    
    Returns the earthquakes with their details.
    Respects trigger criteria if defined on the box.
    """
    service = get_earthquake_parametric_service()
    try:
        earthquakes = await service.get_historical_earthquakes(
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_magnitude=analysis.min_magnitude,
            dataset=analysis.dataset,
        )
        
        box_earthquakes = service.find_earthquakes_in_box(earthquakes, analysis.box)
        
        # Filter by trigger criteria if defined
        if analysis.box.trigger:
            box_earthquakes = service.filter_by_trigger_criteria(
                box_earthquakes, analysis.box.trigger
            )
        
        return success_response(box_earthquakes)
    except Exception:
        logger.exception("Failed to analyze earthquakes in box")
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Analysis failed", "details": None},
        )


@router.post("/analysis/statistics", response_model=EarthquakeBoxStatistics)
@limiter.limit("30/minute")
async def calculate_box_statistics(request: Request, analysis: EarthquakeAnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Calculate comprehensive statistics for earthquakes in a trigger box.
    
    Returns magnitude distribution, depth distribution, annual frequency,
    and trigger probability based on Poisson distribution.
    """
    service = get_earthquake_parametric_service()
    try:
        stats = await service.calculate_statistics(
            box=analysis.box,
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_magnitude=analysis.min_magnitude,
            dataset=analysis.dataset,
        )
        return success_response(stats)
    except Exception:
        logger.exception("Failed to calculate earthquake box statistics")
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Statistics calculation failed", "details": None},
        )


@router.post("/analysis/bulk-statistics", response_model=Dict[str, EarthquakeBoxStatistics])
@limiter.limit("30/minute")
async def calculate_bulk_statistics(request: Request, bulk: EarthquakeBulkAnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Calculate statistics for multiple trigger boxes.
    
    More efficient than calculating one at a time as earthquake data
    is fetched once and reused.
    """
    service = get_earthquake_parametric_service()
    try:
        stats = await service.calculate_all_statistics(
            boxes=bulk.boxes,
            start_year=bulk.start_year,
            end_year=bulk.end_year,
            min_magnitude=bulk.min_magnitude,
            dataset=bulk.dataset,
        )
        return success_response(stats)
    except Exception:
        logger.exception("Failed to calculate bulk earthquake statistics")
        raise HTTPException(
            status_code=500,
            detail={"code": "INTERNAL_ERROR", "message": "Bulk statistics calculation failed", "details": None},
        )
