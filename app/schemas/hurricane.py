"""Pydantic schemas for Hurricane API."""
from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


class HurricaneBase(BaseModel):
    """Base hurricane schema with common fields."""

    name: str = Field(..., description="Storm name")
    basin: str = Field(..., description="Ocean basin (AL, EP, WP, etc.)")
    classification: str = Field(..., description="Storm classification")
    category: Optional[int] = Field(
        None, ge=1, le=5, description="Saffir-Simpson category"
    )
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)
    max_wind_mph: int = Field(..., ge=0)
    max_wind_knots: int = Field(..., ge=0)


class HurricaneCreate(HurricaneBase):
    """Schema for creating a new hurricane record."""

    storm_id: str
    min_pressure_mb: Optional[int] = None
    movement_direction: Optional[str] = None
    movement_speed_mph: Optional[int] = None
    advisory_time: datetime


class HurricaneResponse(HurricaneBase):
    """Schema for hurricane API responses."""

    id: int
    storm_id: str
    min_pressure_mb: Optional[int]
    movement_direction: Optional[str]
    movement_speed_mph: Optional[int]
    advisory_time: datetime
    is_active: bool
    created_at: datetime
    updated_at: datetime

    # GeoJSON geometry
    geometry: dict = Field(default_factory=dict)
    track: Optional[dict] = None  # GeoJSON LineString

    class Config:
        from_attributes = True

    @classmethod
    def from_orm_with_geometry(cls, hurricane: object) -> HurricaneResponse:
        """Create response with GeoJSON geometry.

        Args:
            hurricane: An ORM ``Hurricane`` instance.

        Returns:
            Serialisable response with a GeoJSON Point geometry.
        """
        return cls(
            id=hurricane.id,  # type: ignore[attr-defined]
            storm_id=hurricane.storm_id,  # type: ignore[attr-defined]
            name=hurricane.name,  # type: ignore[attr-defined]
            basin=hurricane.basin,  # type: ignore[attr-defined]
            classification=hurricane.classification,  # type: ignore[attr-defined]
            category=hurricane.category,  # type: ignore[attr-defined]
            latitude=hurricane.latitude,  # type: ignore[attr-defined]
            longitude=hurricane.longitude,  # type: ignore[attr-defined]
            max_wind_mph=hurricane.max_wind_mph,  # type: ignore[attr-defined]
            max_wind_knots=hurricane.max_wind_knots,  # type: ignore[attr-defined]
            min_pressure_mb=hurricane.min_pressure_mb,  # type: ignore[attr-defined]
            movement_direction=hurricane.movement_direction,  # type: ignore[attr-defined]
            movement_speed_mph=hurricane.movement_speed_mph,  # type: ignore[attr-defined]
            advisory_time=hurricane.advisory_time,  # type: ignore[attr-defined]
            is_active=hurricane.is_active,  # type: ignore[attr-defined]
            created_at=hurricane.created_at,  # type: ignore[attr-defined]
            updated_at=hurricane.updated_at,  # type: ignore[attr-defined]
            geometry={
                "type": "Point",
                "coordinates": [hurricane.longitude, hurricane.latitude],  # type: ignore[attr-defined]
            },
            track=None,  # TODO: Convert track geometry to GeoJSON
        )


class HurricaneList(BaseModel):
    """Schema for paginated hurricane list."""

    items: List[HurricaneResponse]
    total: int
    page: int
    per_page: int


class HurricaneFilter(BaseModel):
    """Schema for hurricane filtering."""

    basin: Optional[str] = None
    min_category: Optional[int] = None
    is_active: Optional[bool] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    name: Optional[str] = None
