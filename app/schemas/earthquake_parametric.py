"""Pydantic schemas for earthquake parametric insurance analysis."""
from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel, Field


class EarthquakeDatasetType(str, Enum):
    """Available earthquake datasets."""

    USGS_WORLDWIDE = "usgs_worldwide"
    USGS_US = "usgs_us"


class EarthquakeTriggerCriteria(BaseModel):
    """Trigger criteria for earthquake parametric insurance box."""

    min_magnitude: Optional[float] = Field(
        None, ge=0, le=10, description="Minimum magnitude"
    )
    max_depth_km: Optional[float] = Field(
        None, ge=0, description="Maximum depth in kilometers (shallower = more damaging)"
    )
    min_depth_km: Optional[float] = Field(
        None, ge=0, description="Minimum depth in kilometers"
    )

    def matches(self, magnitude: float, depth_km: float) -> bool:
        """Check if an earthquake matches the trigger criteria.

        Args:
            magnitude: Earthquake magnitude.
            depth_km: Earthquake depth in kilometers.

        Returns:
            ``True`` when the event satisfies all configured thresholds.
        """
        if self.min_magnitude is not None and magnitude < self.min_magnitude:
            return False
        if self.max_depth_km is not None and depth_km > self.max_depth_km:
            return False
        if self.min_depth_km is not None and depth_km < self.min_depth_km:
            return False
        return True


class EarthquakeBoundingBox(BaseModel):
    """A geographic bounding box for earthquake trigger zone analysis."""

    id: str
    name: str
    north: float = Field(..., description="Maximum latitude (north boundary)")
    south: float = Field(..., description="Minimum latitude (south boundary)")
    east: float = Field(..., description="Maximum longitude (east boundary)")
    west: float = Field(..., description="Minimum longitude (west boundary)")
    color: Optional[str] = None
    trigger: Optional[EarthquakeTriggerCriteria] = Field(
        None, description="Trigger criteria for this box"
    )


class HistoricalEarthquake(BaseModel):
    """A historical earthquake event."""

    event_id: str
    magnitude: float
    magnitude_type: Optional[str] = None
    place: str
    event_time: datetime
    latitude: float
    longitude: float
    depth_km: float
    significance: int = 0
    tsunami: int = 0
    url: Optional[str] = None


class EarthquakeBoxStatistics(BaseModel):
    """Statistical analysis of earthquakes in a trigger box."""

    box_id: str
    box_name: str
    total_earthquakes: int
    qualifying_earthquakes: int = Field(
        0, description="Earthquakes meeting trigger criteria"
    )
    years_analyzed: int
    annual_frequency: float
    qualifying_annual_frequency: float = Field(
        0.0, description="Annual frequency of qualifying events"
    )
    magnitude_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Magnitude range -> count"
    )
    depth_distribution: Dict[str, int] = Field(
        default_factory=dict, description="Depth range -> count"
    )
    monthly_distribution: Dict[int, int] = Field(
        default_factory=dict, description="Month -> count"
    )
    average_magnitude: float
    max_magnitude: float
    average_depth_km: float
    shallowest_depth_km: float
    trigger_probability: float = Field(
        ...,
        description="Probability of at least one qualifying earthquake per year",
    )
    trigger_criteria: Optional[EarthquakeTriggerCriteria] = None
    dataset: str = "usgs_worldwide"


class EarthquakeAnalysisRequest(BaseModel):
    """Request parameters for earthquake box analysis."""

    box: EarthquakeBoundingBox
    start_year: int = 1980
    end_year: int = 2024
    min_magnitude: float = 4.0
    dataset: EarthquakeDatasetType = EarthquakeDatasetType.USGS_WORLDWIDE


class EarthquakeBulkAnalysisRequest(BaseModel):
    """Request parameters for analyzing multiple earthquake boxes."""

    boxes: List[EarthquakeBoundingBox]
    start_year: int = 1980
    end_year: int = 2024


class EarthquakeDatasetInfo(BaseModel):
    """Information about an available earthquake dataset."""

    id: str
    name: str
    description: str
    coverage: str
    year_range: tuple[int, int]
    source_url: str
