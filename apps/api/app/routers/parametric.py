"""
API endpoints for parametric insurance analysis.
"""
from __future__ import annotations

from typing import Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query

from app.schemas.parametric import (
    BoxStatistics,
    AnalysisRequest,
    BulkAnalysisRequest,
    YearRange,
    DatasetType,
    DatasetInfo,
)
from app.services.parametric_service import get_parametric_service
from app.services.ibtracs_client import get_ibtracs_client

router = APIRouter(prefix="/parametric", tags=["parametric"])


@router.get("/datasets", response_model=List[DatasetInfo])
async def get_available_datasets():
    """
    Get list of available hurricane datasets.
    
    Returns dataset metadata including name, description, basins, and year range.
    """
    service = get_parametric_service()
    return service.get_available_datasets()


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
        return hurricanes
    except Exception as e:
        error_msg = str(e)
        if "503" in error_msg or "unavailable" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail=f"Data source temporarily unavailable: {error_msg}"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/intersections", response_model=List[dict])
async def get_box_intersections(request: AnalysisRequest):
    """
    Get all hurricanes that intersect with a bounding box.
    
    Returns the intersecting hurricanes with entry/exit points.
    Respects trigger criteria if defined on the box.
    """
    service = get_parametric_service()
    hurricanes = await service.get_historical_hurricanes(
        start_year=request.start_year,
        end_year=request.end_year,
        min_category=request.min_category,
        basin=request.basin,
        dataset=request.dataset,
    )
    
    intersections = service.find_box_intersections(hurricanes, request.box)
    
    # Filter by trigger criteria if defined
    if request.box.trigger:
        intersections = service.filter_by_trigger_criteria(intersections, request.box.trigger)
    
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
    
    return result


@router.post("/analysis/statistics", response_model=BoxStatistics)
async def calculate_box_statistics(request: AnalysisRequest):
    """
    Calculate statistical analysis for a trigger box.
    
    Returns trigger probability, frequency, category distribution, etc.
    Respects trigger criteria if defined on the box.
    """
    service = get_parametric_service()
    stats = await service.analyze_box(
        box=request.box,
        start_year=request.start_year,
        end_year=request.end_year,
        min_category=request.min_category,
        basin=request.basin,
        dataset=request.dataset,
    )
    return stats


@router.post("/analysis/bulk-statistics", response_model=Dict[str, BoxStatistics])
async def calculate_bulk_statistics(request: BulkAnalysisRequest):
    """
    Calculate statistics for multiple boxes at once.
    
    More efficient than calling individual statistics endpoints.
    """
    service = get_parametric_service()
    stats = await service.analyze_multiple_boxes(
        boxes=request.boxes,
        start_year=request.start_year,
        end_year=request.end_year,
        min_category=request.min_category,
        basin=request.basin,
        dataset=request.dataset,
    )
    return stats


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
        return ["atlantic"]
    elif dataset == DatasetType.HURDAT2_PACIFIC:
        return ["pacific"]
    
    client = get_ibtracs_client()
    return client.get_available_basins()


@router.get("/year-range", response_model=YearRange)
async def get_year_range(
    basin: Optional[str] = None,
    dataset: DatasetType = Query(DatasetType.IBTRACS)
):
    """
    Get the available year range for historical data.
    """
    if dataset == DatasetType.HURDAT2_ATLANTIC:
        return YearRange(min_year=1851, max_year=2023)
    elif dataset == DatasetType.HURDAT2_PACIFIC:
        return YearRange(min_year=1949, max_year=2023)
    
    client = get_ibtracs_client()
    min_year, max_year = await client.get_year_range(basin)
    return YearRange(min_year=min_year, max_year=max_year)
