"""Pydantic schemas for Earthquake API."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class EarthquakeBase(BaseModel):
    """Base earthquake schema with common fields."""

    magnitude: float = Field(..., ge=0, le=10, description="Earthquake magnitude")
    magnitude_type: str = Field(..., description="Magnitude type (ml, mb, mw)")
    depth_km: float = Field(..., ge=0, description="Depth in kilometers")
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    place: str = Field(..., description="Human-readable location")


class EarthquakeCreate(EarthquakeBase):
    """Schema for creating a new earthquake record."""

    usgs_id: str
    event_time: datetime
    status: str = "automatic"
    tsunami: int = 0
    significance: int = 0


class EarthquakeResponse(EarthquakeBase):
    """Schema for earthquake API responses."""

    id: int
    usgs_id: str
    event_time: datetime
    status: str
    tsunami: int
    significance: int
    created_at: datetime

    # GeoJSON-style geometry for frontend
    geometry: dict = Field(default_factory=dict)

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_geometry(cls, earthquake: object) -> EarthquakeResponse:
        """Create response with GeoJSON geometry.

        Args:
            earthquake: An ORM ``Earthquake`` instance.

        Returns:
            Serialisable response with a GeoJSON Point geometry.
        """
        return cls(
            id=earthquake.id,  # type: ignore[attr-defined]
            usgs_id=earthquake.usgs_id,  # type: ignore[attr-defined]
            magnitude=earthquake.magnitude,  # type: ignore[attr-defined]
            magnitude_type=earthquake.magnitude_type,  # type: ignore[attr-defined]
            depth_km=earthquake.depth_km,  # type: ignore[attr-defined]
            latitude=earthquake.latitude,  # type: ignore[attr-defined]
            longitude=earthquake.longitude,  # type: ignore[attr-defined]
            place=earthquake.place,  # type: ignore[attr-defined]
            event_time=earthquake.event_time,  # type: ignore[attr-defined]
            status=earthquake.status,  # type: ignore[attr-defined]
            tsunami=earthquake.tsunami,  # type: ignore[attr-defined]
            significance=earthquake.significance,  # type: ignore[attr-defined]
            created_at=earthquake.created_at,  # type: ignore[attr-defined]
            geometry={
                "type": "Point",
                "coordinates": [earthquake.longitude, earthquake.latitude],  # type: ignore[attr-defined]
            },
        )


class EarthquakeList(BaseModel):
    """Schema for paginated earthquake list."""

    items: List[EarthquakeResponse]
    total: int
    page: int
    per_page: int

    @property
    def pages(self) -> int:
        """Total number of pages."""
        return (self.total + self.per_page - 1) // self.per_page


class EarthquakeFilter(BaseModel):
    """Schema for earthquake filtering."""

    min_magnitude: Optional[float] = None
    max_magnitude: Optional[float] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    min_depth: Optional[float] = None
    max_depth: Optional[float] = None
    # Bounding box [west, south, east, north]
    bbox: Optional[List[float]] = None
