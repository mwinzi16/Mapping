"""Pydantic schemas for indemnity insurance historical event data."""
from __future__ import annotations

from typing import List, Optional

from pydantic import BaseModel


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
