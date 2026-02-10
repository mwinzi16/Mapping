"""Database models."""
from __future__ import annotations

from app.models.earthquake import Earthquake
from app.models.hurricane import Hurricane
from app.models.severe_weather import SevereWeather, SevereWeatherType
from app.models.subscription import Subscription
from app.models.wildfire import Wildfire

__all__ = [
    "Earthquake",
    "Hurricane",
    "SevereWeather",
    "SevereWeatherType",
    "Subscription",
    "Wildfire",
]
