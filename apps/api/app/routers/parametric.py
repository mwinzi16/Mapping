"""
API endpoints for parametric insurance analysis.
"""
from __future__ import annotations

import logging
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request

from app.core.auth import get_api_key
from app.core.rate_limit import limiter
from app.core.response import success_response
from app.schemas.parametric import (
    AnalysisRequest,
    BoxStatistics,
    BulkAnalysisRequest,
    DatasetInfo,
    DatasetType,
    YearRange,
)
from app.services.ibtracs_client import get_ibtracs_client
from app.services.parametric_service import get_parametric_service

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/parametric", tags=["parametric"])


@router.get("/datasets", response_model=List[DatasetInfo])
async def get_available_datasets():
    """
    Get list of available hurricane datasets.
    
    Returns dataset metadata including name, description, basins, and year range.
    """
    service = get_parametric_service()
    return success_response(service.get_available_datasets())


@router.get("/hurricanes/historical", response_model=List[dict])
async def get_historical_hurricanes(
    start_year: int = Query(1980, ge=1850, le=2030),
    end_year: int = Query(2024, ge=1850, le=2030),
    min_category: int = Query(0, ge=0, le=5),
    basin: Optional[str] = Query(None),
    dataset: DatasetType = Query(DatasetType.IBTRACS),
):
    """
    Fetch historical hurricane data with optional filters.
    
    Returns hurricanes with their complete track data for visualization.
    Supports multiple data sources (IBTrACS, HURDAT2).
    """
    service = get_parametric_service()
    try:
        hurricanes = await service.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=dataset,
        )
        return success_response(hurricanes)
    except Exception:
        logger.exception("Failed to fetch historical hurricanes")
        raise HTTPException(
            status_code=502,
            detail={"code": "EXTERNAL_SERVICE_ERROR", "message": "Data source temporarily unavailable", "details": None},
        )


@router.post("/analysis/intersections", response_model=List[dict])
@limiter.limit("30/minute")
async def get_box_intersections(request: Request, analysis: AnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Get all hurricanes that intersect with a bounding box.
    
    Returns the intersecting hurricanes with entry/exit points.
    Respects trigger criteria if defined on the box.
    """
    service = get_parametric_service()
    hurricanes = await service.get_historical_hurricanes(
        start_year=analysis.start_year,
        end_year=analysis.end_year,
        min_category=analysis.min_category,
        basin=analysis.basin,
        dataset=analysis.dataset,
    )
    
    intersections = service.find_box_intersections(hurricanes, analysis.box)
    
    # Filter by trigger criteria if defined
    if analysis.box.trigger:
        intersections = service.filter_by_trigger_criteria(intersections, analysis.box.trigger)
    
    # Return simplified hurricane data without full track
    result = []
    for intersection in intersections:
        hurricane = intersection["hurricane"]
        result.append({
            "storm_id": hurricane["storm_id"],
            "name": hurricane["name"],
            "year": hurricane["year"],
            "basin": hurricane["basin"],
            "max_category": hurricane["max_category"],
            "max_wind_knots": hurricane["max_wind_knots"],
            "entry_point": intersection["entry_point"],
            "exit_point": intersection["exit_point"],
            "max_intensity_in_box": intersection["max_intensity_in_box"],
            "min_pressure_in_box": intersection.get("min_pressure_in_box"),
            "category_at_crossing": intersection["category_at_crossing"],
        })
    
    return success_response(result)


@router.post("/analysis/statistics", response_model=BoxStatistics)
@limiter.limit("30/minute")
async def calculate_box_statistics(request: Request, analysis: AnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Calculate statistical analysis for a trigger box.
    
    Returns trigger probability, frequency, category distribution, etc.
    Respects trigger criteria if defined on the box.
    """
    service = get_parametric_service()
    stats = await service.analyze_box(
        box=analysis.box,
        start_year=analysis.start_year,
        end_year=analysis.end_year,
        min_category=analysis.min_category,
        basin=analysis.basin,
        dataset=analysis.dataset,
    )
    return success_response(stats)


@router.post("/analysis/bulk-statistics", response_model=Dict[str, BoxStatistics])
@limiter.limit("30/minute")
async def calculate_bulk_statistics(request: Request, bulk: BulkAnalysisRequest, api_key: str = Depends(get_api_key)):
    """
    Calculate statistics for multiple boxes at once.
    
    More efficient than calling individual statistics endpoints.
    """
    service = get_parametric_service()
    stats = await service.analyze_multiple_boxes(
        boxes=bulk.boxes,
        start_year=bulk.start_year,
        end_year=bulk.end_year,
        min_category=bulk.min_category,
        basin=bulk.basin,
        dataset=bulk.dataset,
    )
    return success_response(stats)


@router.get("/basins", response_model=List[str])
async def get_available_basins(
    dataset: DatasetType = Query(DatasetType.IBTRACS)
):
    """
    Get list of available ocean basins for a dataset.
    
    Basin codes vary by dataset:
    - IBTrACS: NA, EP, WP, NI, SI, SP
    - HURDAT2 Atlantic: atlantic
    - HURDAT2 Pacific: pacific
    """
    if dataset == DatasetType.HURDAT2_ATLANTIC:
        return success_response(["atlantic"])
    elif dataset == DatasetType.HURDAT2_PACIFIC:
        return success_response(["pacific"])
    
    client = get_ibtracs_client()
    return success_response(client.get_available_basins())


@router.get("/year-range", response_model=YearRange)
async def get_year_range(
    basin: Optional[str] = None,
    dataset: DatasetType = Query(DatasetType.IBTRACS)
):
    """
    Get the available year range for historical data.
    """
    if dataset == DatasetType.HURDAT2_ATLANTIC:
        return success_response(YearRange(min_year=1851, max_year=2023))
    elif dataset == DatasetType.HURDAT2_PACIFIC:
        return success_response(YearRange(min_year=1949, max_year=2023))
    
    client = get_ibtracs_client()
    min_year, max_year = await client.get_year_range(basin)
    return success_response(YearRange(min_year=min_year, max_year=max_year))
