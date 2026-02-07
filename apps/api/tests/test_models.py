"""Tests for SQLAlchemy model __repr__ and basic constraints."""
from __future__ import annotations

from unittest.mock import MagicMock

import pytest


class TestEarthquakeRepr:
    """Earthquake model representation."""

    def test_earthquake_repr(self) -> None:
        from app.models.earthquake import Earthquake

        eq = Earthquake.__new__(Earthquake)
        eq.id = 1
        eq.magnitude = 6.5
        eq.place = "10km N of Ridgecrest, CA"
        assert repr(eq) == "<Earthquake(id=1, M6.5, 10km N of Ridgecrest, CA)>"


class TestHurricaneRepr:
    """Hurricane model representation."""

    def test_hurricane_repr(self) -> None:
        from app.models.hurricane import Hurricane

        h = Hurricane.__new__(Hurricane)
        h.id = 2
        h.name = "Ida"
        h.category = 4
        assert repr(h) == "<Hurricane(id=2, Ida, Cat4)>"


class TestWildfireRepr:
    """Wildfire model representation."""

    def test_wildfire_repr(self) -> None:
        from app.models.wildfire import Wildfire

        w = Wildfire.__new__(Wildfire)
        w.id = 3
        w.name = "Dixie Fire"
        assert repr(w) == "<Wildfire(id=3, Dixie Fire)>"


class TestSevereWeatherRepr:
    """SevereWeather model representation."""

    def test_severe_weather_repr(self) -> None:
        from app.models.severe_weather import SevereWeather, SevereWeatherType

        sw = SevereWeather.__new__(SevereWeather)
        sw.id = 4
        sw.event_type = SevereWeatherType.TORNADO
        assert repr(sw) == "<SevereWeather(id=4, SevereWeatherType.TORNADO)>"


class TestSubscriptionRepr:
    """Subscription model representation."""

    def test_subscription_repr(self) -> None:
        from app.models.subscription import Subscription

        sub = Subscription.__new__(Subscription)
        sub.id = 5
        sub.is_verified = True
        assert repr(sub) == "<Subscription(id=5, verified=True)>"
