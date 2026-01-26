"""Pydantic schemas for API request/response validation."""
from app.schemas.earthquake import EarthquakeCreate, EarthquakeResponse, EarthquakeList
from app.schemas.hurricane import HurricaneCreate, HurricaneResponse, HurricaneList
from app.schemas.parametric import (
    BoundingBox,
    HistoricalHurricane,
    BoxStatistics,
    AnalysisRequest,
    BulkAnalysisRequest,
)

__all__ = [
    "EarthquakeCreate",
    "EarthquakeResponse", 
    "EarthquakeList",
    "HurricaneCreate",
    "HurricaneResponse",
    "HurricaneList",
    "BoundingBox",
    "HistoricalHurricane",
    "BoxStatistics",
    "AnalysisRequest",
    "BulkAnalysisRequest",
]
