"""
Pydantic schemas for parametric insurance analysis.
"""
from datetime import datetime
from typing import Optional, List, Dict, Literal
from pydantic import BaseModel, Field
from enum import Enum


class DatasetType(str, Enum):
    """Available hurricane datasets."""
    IBTRACS = "ibtracs"
    HURDAT2_ATLANTIC = "hurdat2_atlantic"
    HURDAT2_PACIFIC = "hurdat2_pacific"


class TriggerCriteria(BaseModel):
    """Trigger criteria for parametric insurance box."""
    min_category: Optional[int] = Field(None, ge=0, le=5, description="Minimum Saffir-Simpson category (0=TS, 1-5)")
    min_wind_knots: Optional[int] = Field(None, ge=0, description="Minimum wind speed in knots")
    max_pressure_mb: Optional[int] = Field(None, ge=800, le=1100, description="Maximum central pressure in millibars")
    
    def matches(self, category: int, wind_knots: int, pressure_mb: Optional[int]) -> bool:
        """Check if a hurricane point matches the trigger criteria."""
        if self.min_category is not None and category < self.min_category:
            return False
        if self.min_wind_knots is not None and wind_knots < self.min_wind_knots:
            return False
        if self.max_pressure_mb is not None:
            if pressure_mb is None or pressure_mb > self.max_pressure_mb:
                return False
        return True


class BoundingBox(BaseModel):
    """A geographic bounding box for trigger zone analysis."""
    id: str
    name: str
    north: float = Field(..., description="Maximum latitude (north boundary)")
    south: float = Field(..., description="Minimum latitude (south boundary)")
    east: float = Field(..., description="Maximum longitude (east boundary)")
    west: float = Field(..., description="Minimum longitude (west boundary)")
    color: Optional[str] = None
    trigger: Optional[TriggerCriteria] = Field(None, description="Trigger criteria for this box")


class HurricaneTrackPoint(BaseModel):
    """A single point on a hurricane's track."""
    timestamp: datetime
    latitude: float
    longitude: float
    wind_knots: int
    pressure_mb: Optional[int] = None
    category: int
    status: str


class HistoricalHurricane(BaseModel):
    """A historical hurricane with its complete track."""
    storm_id: str
    name: str
    year: int
    basin: str
    max_category: int
    max_wind_knots: int
    min_pressure_mb: Optional[int] = None
    track: List[HurricaneTrackPoint]
    start_date: datetime
    end_date: datetime


class HistoricalHurricaneSummary(BaseModel):
    """Summary version without full track for list views."""
    storm_id: str
    name: str
    year: int
    basin: str
    max_category: int
    max_wind_knots: int
    min_pressure_mb: Optional[int] = None
    start_date: datetime
    end_date: datetime


class BoxIntersection(BaseModel):
    """Information about a hurricane crossing a trigger box."""
    box_id: str
    hurricane: HistoricalHurricaneSummary
    entry_point: HurricaneTrackPoint
    exit_point: Optional[HurricaneTrackPoint] = None
    max_intensity_in_box: int
    category_at_crossing: int


class BoxStatistics(BaseModel):
    """Statistical analysis of hurricanes crossing a trigger box."""
    box_id: str
    box_name: str
    total_hurricanes: int
    qualifying_hurricanes: int = Field(0, description="Hurricanes meeting trigger criteria")
    years_analyzed: int
    annual_frequency: float
    qualifying_annual_frequency: float = Field(0.0, description="Annual frequency of qualifying events")
    category_distribution: Dict[int, int]
    monthly_distribution: Dict[int, int]
    average_intensity_knots: float
    max_intensity_knots: int
    trigger_probability: float = Field(
        ...,
        description="Probability of at least one qualifying hurricane crossing per year"
    )
    trigger_criteria: Optional[TriggerCriteria] = None
    dataset: str = "ibtracs"


class AnalysisRequest(BaseModel):
    """Request parameters for box analysis."""
    box: BoundingBox
    start_year: int = 1980
    end_year: int = 2024
    min_category: int = 0
    basin: Optional[str] = None
    dataset: DatasetType = DatasetType.IBTRACS


class BulkAnalysisRequest(BaseModel):
    """Request parameters for analyzing multiple boxes."""
    boxes: List[BoundingBox]
    start_year: int = 1980
    end_year: int = 2024
    min_category: int = 0
    basin: Optional[str] = None
    dataset: DatasetType = DatasetType.IBTRACS


class YearRange(BaseModel):
    """Available year range for historical data."""
    min_year: int
    max_year: int


class DatasetInfo(BaseModel):
    """Information about an available dataset."""
    id: str
    name: str
    description: str
    basins: List[str]
    year_range: tuple[int, int]
    source_url: str
