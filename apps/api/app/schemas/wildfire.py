"""
Pydantic schemas for Wildfire API.
"""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class WildfireBase(BaseModel):
    """Base wildfire schema."""
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    name: Optional[str] = None
    brightness: Optional[float] = None
    frp: Optional[float] = Field(None, description="Fire Radiative Power in MW")
    confidence: Optional[int] = Field(None, ge=0, le=100)
    acres_burned: Optional[float] = None
    containment_percent: Optional[int] = Field(None, ge=0, le=100)


class WildfireCreate(WildfireBase):
    """Schema for creating a wildfire record."""
    source_id: str
    source: str
    satellite: Optional[str] = None
    detected_at: datetime


class WildfireResponse(WildfireBase):
    """Schema for wildfire API responses."""
    id: int
    source_id: str
    source: str
    satellite: Optional[str]
    detected_at: datetime
    is_active: bool
    created_at: datetime
    geometry: dict = Field(default_factory=dict)
    
    class Config:
        from_attributes = True
    
    @classmethod
    def from_orm_with_geometry(cls, wildfire):
        return cls(
            id=wildfire.id,
            source_id=wildfire.source_id,
            latitude=wildfire.latitude,
            longitude=wildfire.longitude,
            name=wildfire.name,
            brightness=wildfire.brightness,
            frp=wildfire.frp,
            confidence=wildfire.confidence,
            acres_burned=wildfire.acres_burned,
            containment_percent=wildfire.containment_percent,
            source=wildfire.source,
            satellite=wildfire.satellite,
            detected_at=wildfire.detected_at,
            is_active=wildfire.is_active,
            created_at=wildfire.created_at,
            geometry={
                "type": "Point",
                "coordinates": [wildfire.longitude, wildfire.latitude]
            }
        )


class WildfireList(BaseModel):
    """Schema for wildfire list response."""
    items: List[WildfireResponse]
    total: int
    page: int
    per_page: int
