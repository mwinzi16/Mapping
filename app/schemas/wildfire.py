"""Pydantic schemas for Wildfire API."""
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
    def from_orm_with_geometry(cls, wildfire: object) -> WildfireResponse:
        """Create response with GeoJSON geometry.

        Args:
            wildfire: An ORM ``Wildfire`` instance.

        Returns:
            Serialisable response with a GeoJSON Point geometry.
        """
        return cls(
            id=wildfire.id,  # type: ignore[attr-defined]
            source_id=wildfire.source_id,  # type: ignore[attr-defined]
            latitude=wildfire.latitude,  # type: ignore[attr-defined]
            longitude=wildfire.longitude,  # type: ignore[attr-defined]
            name=wildfire.name,  # type: ignore[attr-defined]
            brightness=wildfire.brightness,  # type: ignore[attr-defined]
            frp=wildfire.frp,  # type: ignore[attr-defined]
            confidence=wildfire.confidence,  # type: ignore[attr-defined]
            acres_burned=wildfire.acres_burned,  # type: ignore[attr-defined]
            containment_percent=wildfire.containment_percent,  # type: ignore[attr-defined]
            source=wildfire.source,  # type: ignore[attr-defined]
            satellite=wildfire.satellite,  # type: ignore[attr-defined]
            detected_at=wildfire.detected_at,  # type: ignore[attr-defined]
            is_active=wildfire.is_active,  # type: ignore[attr-defined]
            created_at=wildfire.created_at,  # type: ignore[attr-defined]
            geometry={
                "type": "Point",
                "coordinates": [wildfire.longitude, wildfire.latitude],  # type: ignore[attr-defined]
            },
        )


class WildfireList(BaseModel):
    """Schema for wildfire list response."""

    items: List[WildfireResponse]
    total: int
    page: int
    per_page: int
