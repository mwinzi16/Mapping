"""
Pydantic schemas for Severe Weather API.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field


EventType = Literal["tornado", "hail", "flooding", "wind", "thunderstorm"]


class SevereWeatherBase(BaseModel):
    """Base severe weather schema."""
    event_type: EventType
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    location: Optional[str] = None
    state: Optional[str] = None
    county: Optional[str] = None
    description: Optional[str] = None


class TornadoData(BaseModel):
    """Tornado-specific fields."""
    tornado_scale: Optional[int] = Field(None, ge=0, le=5, description="EF scale 0-5")
    tornado_width_yards: Optional[int] = None
    tornado_length_miles: Optional[float] = None


class HailData(BaseModel):
    """Hail-specific fields."""
    hail_size_inches: Optional[float] = Field(None, description="Hail diameter in inches")


class FloodingData(BaseModel):
    """Flooding-specific fields."""
    flood_severity: Optional[str] = Field(None, description="minor, moderate, major")
    river_name: Optional[str] = None
    flood_stage_ft: Optional[float] = None
    observed_stage_ft: Optional[float] = None


class SevereWeatherCreate(SevereWeatherBase):
    """Schema for creating a severe weather record."""
    source_id: str
    source: str
    event_time: datetime
    expires_at: Optional[datetime] = None
    # Type-specific fields
    tornado_scale: Optional[int] = None
    tornado_width_yards: Optional[int] = None
    tornado_length_miles: Optional[float] = None
    hail_size_inches: Optional[float] = None
    flood_severity: Optional[str] = None
    river_name: Optional[str] = None
    flood_stage_ft: Optional[float] = None
    observed_stage_ft: Optional[float] = None
    wind_speed_mph: Optional[int] = None


class SevereWeatherResponse(SevereWeatherBase):
    """Schema for severe weather API responses."""
    id: int
    source_id: str
    source: str
    event_time: datetime
    expires_at: Optional[datetime]
    created_at: datetime
    geometry: dict = Field(default_factory=dict)
    
    # Type-specific fields
    tornado_scale: Optional[int] = None
    tornado_width_yards: Optional[int] = None
    tornado_length_miles: Optional[float] = None
    hail_size_inches: Optional[float] = None
    flood_severity: Optional[str] = None
    river_name: Optional[str] = None
    flood_stage_ft: Optional[float] = None
    observed_stage_ft: Optional[float] = None
    wind_speed_mph: Optional[int] = None
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_geometry(cls, event):
        return cls(
            id=event.id,
            source_id=event.source_id,
            event_type=event.event_type.value,
            latitude=event.latitude,
            longitude=event.longitude,
            location=event.location,
            state=event.state,
            county=event.county,
            description=event.description,
            source=event.source,
            event_time=event.event_time,
            expires_at=event.expires_at,
            created_at=event.created_at,
            tornado_scale=event.tornado_scale,
            tornado_width_yards=event.tornado_width_yards,
            tornado_length_miles=event.tornado_length_miles,
            hail_size_inches=event.hail_size_inches,
            flood_severity=event.flood_severity,
            river_name=event.river_name,
            flood_stage_ft=event.flood_stage_ft,
            observed_stage_ft=event.observed_stage_ft,
            wind_speed_mph=event.wind_speed_mph,
            geometry={
                "type": "Point",
                "coordinates": [event.longitude, event.latitude]
            }
        )


class SevereWeatherList(BaseModel):
    """Schema for severe weather list response."""
    items: List[SevereWeatherResponse]
    total: int
    event_type: Optional[str] = None
