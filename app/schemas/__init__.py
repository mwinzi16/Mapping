"""Pydantic schemas for API request/response validation."""
from __future__ import annotations

from app.schemas.earthquake import (
    EarthquakeBase,
    EarthquakeCreate,
    EarthquakeFilter,
    EarthquakeList,
    EarthquakeResponse,
)
from app.schemas.earthquake_parametric import (
    EarthquakeAnalysisRequest,
    EarthquakeBoundingBox,
    EarthquakeBoxStatistics,
    EarthquakeBulkAnalysisRequest,
    EarthquakeDatasetType,
    EarthquakeTriggerCriteria,
    HistoricalEarthquake,
)
from app.schemas.hurricane import (
    HurricaneCreate,
    HurricaneFilter,
    HurricaneList,
    HurricaneResponse,
)
from app.schemas.parametric import (
    AnalysisRequest,
    BoundingBox,
    BoxStatistics,
    BulkAnalysisRequest,
    HistoricalHurricane,
)
from app.schemas.severe_weather import (
    SevereWeatherCreate,
    SevereWeatherList,
    SevereWeatherResponse,
)
from app.schemas.subscription import (
    SubscriptionCreate,
    SubscriptionMessage,
    SubscriptionResponse,
)
from app.schemas.wildfire import WildfireCreate, WildfireList, WildfireResponse

__all__ = [
    "EarthquakeBase",
    "EarthquakeCreate",
    "EarthquakeFilter",
    "EarthquakeList",
    "EarthquakeResponse",
    "EarthquakeAnalysisRequest",
    "EarthquakeBoundingBox",
    "EarthquakeBoxStatistics",
    "EarthquakeBulkAnalysisRequest",
    "EarthquakeDatasetType",
    "EarthquakeTriggerCriteria",
    "HistoricalEarthquake",
    "HurricaneCreate",
    "HurricaneFilter",
    "HurricaneList",
    "HurricaneResponse",
    "AnalysisRequest",
    "BoundingBox",
    "BoxStatistics",
    "BulkAnalysisRequest",
    "HistoricalHurricane",
    "SevereWeatherCreate",
    "SevereWeatherList",
    "SevereWeatherResponse",
    "SubscriptionCreate",
    "SubscriptionMessage",
    "SubscriptionResponse",
    "WildfireCreate",
    "WildfireList",
    "WildfireResponse",
]
