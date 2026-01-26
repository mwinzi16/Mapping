"""
API endpoints for earthquake parametric insurance analysis.
"""
from typing import List, Optional, Dict
from fastapi import APIRouter, Query, HTTPException

from app.schemas.earthquake_parametric import (
    EarthquakeBoxStatistics,
    EarthquakeAnalysisRequest,
    EarthquakeBulkAnalysisRequest,
    EarthquakeDatasetType,
    EarthquakeDatasetInfo,
)
from app.services.earthquake_parametric_service import get_earthquake_parametric_service

router = APIRouter(prefix="/earthquake-parametric", tags=["earthquake-parametric"])


@router.get("/datasets", response_model=List[EarthquakeDatasetInfo])
async def get_available_datasets():
    """
    Get list of available earthquake datasets.
    
    Returns dataset metadata including name, description, coverage, and year range.
    """
    service = get_earthquake_parametric_service()
    return service.get_available_datasets()


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
        return earthquakes
    except Exception as e:
        error_msg = str(e)
        if "503" in error_msg or "unavailable" in error_msg.lower():
            raise HTTPException(
                status_code=503,
                detail=f"Data source temporarily unavailable: {error_msg}"
            )
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/earthquakes", response_model=List[dict])
async def get_earthquakes_in_box(request: EarthquakeAnalysisRequest):
    """
    Get all earthquakes that fall within a bounding box.
    
    Returns the earthquakes with their details.
    Respects trigger criteria if defined on the box.
    """
    service = get_earthquake_parametric_service()
    try:
        earthquakes = await service.get_historical_earthquakes(
            start_year=request.start_year,
            end_year=request.end_year,
            min_magnitude=request.min_magnitude,
            dataset=request.dataset,
        )
        
        box_earthquakes = service.find_earthquakes_in_box(earthquakes, request.box)
        
        # Filter by trigger criteria if defined
        if request.box.trigger:
            box_earthquakes = service.filter_by_trigger_criteria(
                box_earthquakes, request.box.trigger
            )
        
        return box_earthquakes
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/statistics", response_model=EarthquakeBoxStatistics)
async def calculate_box_statistics(request: EarthquakeAnalysisRequest):
    """
    Calculate comprehensive statistics for earthquakes in a trigger box.
    
    Returns magnitude distribution, depth distribution, annual frequency,
    and trigger probability based on Poisson distribution.
    """
    service = get_earthquake_parametric_service()
    try:
        stats = await service.calculate_statistics(
            box=request.box,
            start_year=request.start_year,
            end_year=request.end_year,
            min_magnitude=request.min_magnitude,
            dataset=request.dataset,
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/analysis/bulk-statistics", response_model=Dict[str, EarthquakeBoxStatistics])
async def calculate_bulk_statistics(request: EarthquakeBulkAnalysisRequest):
    """
    Calculate statistics for multiple trigger boxes.
    
    More efficient than calculating one at a time as earthquake data
    is fetched once and reused.
    """
    service = get_earthquake_parametric_service()
    try:
        stats = await service.calculate_all_statistics(
            boxes=request.boxes,
            start_year=request.start_year,
            end_year=request.end_year,
            min_magnitude=request.min_magnitude,
            dataset=request.dataset,
        )
        return stats
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
