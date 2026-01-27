"""
API endpoints for indemnity insurance historical event data.
Provides access to significant historical hurricanes and earthquakes
for TIV impact analysis.
"""
from typing import List, Optional, Literal
from fastapi import APIRouter, Query, HTTPException
from pydantic import BaseModel

from app.services.parametric_service import get_parametric_service
from app.services.earthquake_parametric_service import get_earthquake_parametric_service
from app.schemas.parametric import DatasetType
from app.schemas.earthquake_parametric import EarthquakeDatasetType

router = APIRouter(prefix="/indemnity", tags=["indemnity"])


# =============================================================================
# SCHEMAS
# =============================================================================

class HistoricalEarthquake(BaseModel):
    """Simplified earthquake for indemnity historical analysis."""
    id: str
    name: str
    magnitude: float
    lat: float
    lon: float
    date: str
    depth_km: Optional[float] = None
    deaths: Optional[int] = None
    damage_usd: Optional[float] = None
    significance_score: float


class HistoricalHurricane(BaseModel):
    """Hurricane with full track for indemnity historical analysis."""
    id: str
    name: str
    season: int
    max_category: int
    max_wind_mph: float
    min_pressure_mb: Optional[float] = None
    damage_usd: Optional[float] = None
    deaths: Optional[int] = None
    significance_score: float
    track: List[dict]


# =============================================================================
# SIGNIFICANT EVENT CALCULATION
# =============================================================================

def calculate_earthquake_significance(eq: dict) -> float:
    """
    Calculate significance score for an earthquake.
    Based on magnitude (exponential scale) and damage if available.
    """
    magnitude = eq.get("magnitude", 0)
    damage = eq.get("damage_usd", 0) or 0
    
    # Magnitude contributes exponentially (Richter scale is logarithmic)
    mag_score = 10 ** (magnitude - 4)  # Normalize so M4 = 1, M5 = 10, M6 = 100, etc.
    
    # Damage contributes linearly (normalized to billions)
    damage_score = damage / 1_000_000_000 if damage > 0 else 0
    
    # Combined score (magnitude is primary, damage is secondary)
    return mag_score + (damage_score * 10)


def calculate_hurricane_significance(hurricane: dict) -> float:
    """
    Calculate significance score for a hurricane.
    Based on category, wind speed, and damage if available.
    """
    category = hurricane.get("max_category", 0)
    wind = hurricane.get("max_wind_knots", 0) or hurricane.get("max_wind_mph", 0)
    damage = hurricane.get("damage_usd", 0) or 0
    
    # Category contributes exponentially
    cat_score = 2 ** category if category > 0 else 0.5
    
    # Wind speed normalized (100 knots = 1.0)
    wind_score = wind / 100
    
    # Damage in billions
    damage_score = damage / 1_000_000_000 if damage > 0 else 0
    
    # Combined score
    return (cat_score * 10) + (wind_score * 5) + (damage_score * 2)


# =============================================================================
# ENDPOINTS
# =============================================================================

@router.get("/historical/earthquakes", response_model=List[HistoricalEarthquake])
async def get_historical_earthquakes(
    mode: Literal["all", "significant"] = Query("significant", description="Load all or top significant events"),
    limit: int = Query(30, ge=1, le=100, description="Number of events for significant mode"),
    start_year: int = Query(1980, ge=1900, le=2030),
    end_year: int = Query(2025, ge=1900, le=2030),
    min_magnitude: float = Query(6.0, ge=4.0, le=10.0, description="Minimum magnitude to include"),
):
    """
    Get historical earthquakes for indemnity impact analysis.
    
    - **mode=significant**: Returns top N earthquakes sorted by significance score
    - **mode=all**: Returns all earthquakes matching criteria (paginated)
    
    Significance is calculated from magnitude (primary) and estimated damage (secondary).
    """
    service = get_earthquake_parametric_service()
    
    try:
        earthquakes = await service.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=EarthquakeDatasetType.USGS_WORLDWIDE,
        )
        
        # Transform and calculate significance
        result = []
        for eq in earthquakes:
            significance = calculate_earthquake_significance(eq)
            
            # Get name with fallback - USGS client uses "place" field
            name = eq.get("place") or eq.get("name") or "Unknown Location"
            
            # Get coordinates - client returns latitude/longitude
            lat = eq.get("latitude") or 0
            lon = eq.get("longitude") or 0
            
            # Get date string - client returns event_time as ISO string
            date_val = eq.get("event_time") or eq.get("time") or eq.get("date") or ""
            if isinstance(date_val, (int, float)):
                from datetime import datetime
                date_val = datetime.fromtimestamp(date_val / 1000).isoformat()
            
            result.append(HistoricalEarthquake(
                id=str(eq.get("event_id") or eq.get("id") or eq.get("usgs_id") or ""),
                name=str(name),
                magnitude=float(eq.get("magnitude") or eq.get("mag") or 0),
                lat=float(lat),
                lon=float(lon),
                date=str(date_val),
                depth_km=eq.get("depth_km"),
                deaths=eq.get("deaths"),
                damage_usd=eq.get("damage_usd"),
                significance_score=significance,
            ))
        
        # Sort by significance (descending)
        result.sort(key=lambda x: x.significance_score, reverse=True)
        
        # Apply limit for significant mode
        if mode == "significant":
            result = result[:limit]
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch earthquakes: {str(e)}")


@router.get("/historical/hurricanes", response_model=List[HistoricalHurricane])
async def get_historical_hurricanes(
    mode: Literal["all", "significant"] = Query("significant", description="Load all or top significant events"),
    limit: int = Query(30, ge=1, le=100, description="Number of events for significant mode"),
    start_year: int = Query(1980, ge=1850, le=2030),
    end_year: int = Query(2025, ge=1850, le=2030),
    min_category: int = Query(1, ge=0, le=5, description="Minimum category to include"),
    basin: Optional[str] = Query(None, description="Basin filter (NA, EP, WP, etc.)"),
):
    """
    Get historical hurricanes with full track data for indemnity impact analysis.
    
    - **mode=significant**: Returns top N hurricanes sorted by significance score
    - **mode=all**: Returns all hurricanes matching criteria
    
    Significance is calculated from category, wind speed, and estimated damage.
    """
    service = get_parametric_service()
    
    try:
        hurricanes = await service.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=DatasetType.IBTRACS,
        )
        
        # Transform and calculate significance
        result = []
        for h in hurricanes:
            significance = calculate_hurricane_significance(h)
            
            # Convert track data to consistent format
            track = []
            for point in h.get("track", []):
                track.append({
                    "lat": point.get("lat", point.get("latitude", 0)),
                    "lon": point.get("lon", point.get("longitude", 0)),
                    "time": point.get("time", point.get("iso_time", "")),
                    "wind_mph": point.get("wind_mph", point.get("usa_wind", 0)),
                    "pressure_mb": point.get("pressure_mb", point.get("usa_pres")),
                    "category": point.get("category"),
                    "status": point.get("status", point.get("nature", "unknown")),
                })
            
            result.append(HistoricalHurricane(
                id=h.get("storm_id", h.get("id", "")),
                name=h.get("name", "Unnamed"),
                season=h.get("year", h.get("season", 0)),
                max_category=h.get("max_category", 0),
                max_wind_mph=h.get("max_wind_knots", 0) * 1.15078 if h.get("max_wind_knots") else h.get("max_wind_mph", 0),
                min_pressure_mb=h.get("min_pressure"),
                damage_usd=h.get("damage_usd"),
                deaths=h.get("deaths"),
                significance_score=significance,
                track=track,
            ))
        
        # Sort by significance (descending)
        result.sort(key=lambda x: x.significance_score, reverse=True)
        
        # Apply limit for significant mode
        if mode == "significant":
            result = result[:limit]
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch hurricanes: {str(e)}")


@router.get("/historical/summary")
async def get_historical_summary():
    """
    Get summary of available historical data for the UI.
    """
    return {
        "earthquakes": {
            "datasets": ["USGS Worldwide"],
            "year_range": {"min": 1900, "max": 2025},
            "magnitude_range": {"min": 4.0, "max": 10.0},
            "default_mode": "significant",
            "default_limit": 30,
        },
        "hurricanes": {
            "datasets": ["IBTrACS"],
            "year_range": {"min": 1850, "max": 2025},
            "basins": ["NA", "EP", "WP", "NI", "SI", "SP", "SA"],
            "category_range": {"min": 0, "max": 5},
            "default_mode": "significant",
            "default_limit": 30,
        }
    }
