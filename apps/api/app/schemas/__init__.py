"""Pydantic schemas for API request/response validation."""
from __future__ import annotations

from app.schemas.earthquake import EarthquakeCreate, EarthquakeResponse, EarthquakeList
from app.schemas.hurricane import HurricaneCreate, HurricaneResponse, HurricaneList
from app.schemas.parametric import (
    BoundingBox,
    HistoricalHurricane,
    BoxStatistics,
    AnalysisRequest,
    BulkAnalysisRequest,
)
from app.schemas.severe_weather import SevereWeatherCreate, SevereWeatherResponse
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionResponse,
    SubscriptionMessage,
)
from app.schemas.wildfire import WildfireCreate, WildfireResponse, WildfireList

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
    "SevereWeatherCreate",
    "SevereWeatherResponse",
    "SubscriptionCreate",
    "SubscriptionResponse",
    "SubscriptionMessage",
    "WildfireCreate",
    "WildfireResponse",
    "WildfireList",
]
