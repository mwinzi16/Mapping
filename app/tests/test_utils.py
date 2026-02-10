"""Tests for utility modules: weather, privacy, geojson, cache."""
from __future__ import annotations

import time
from datetime import datetime, timezone

import pytest

# ---------------------------------------------------------------------------
# weather.py — wind_to_category
# ---------------------------------------------------------------------------
from app.utils.weather import wind_to_category


class TestWindToCategory:
    """Tests for Saffir-Simpson wind-speed-to-category conversion."""

    def test_wind_to_category_tropical_storm(self) -> None:
        assert wind_to_category(50) == 0

    def test_wind_to_category_zero_wind(self) -> None:
        assert wind_to_category(0) == 0

    def test_wind_to_category_1_lower_bound(self) -> None:
        assert wind_to_category(64) == 1

    def test_wind_to_category_1_upper_bound(self) -> None:
        assert wind_to_category(82) == 1

    def test_wind_to_category_2_lower_bound(self) -> None:
        assert wind_to_category(83) == 2

    def test_wind_to_category_2_upper_bound(self) -> None:
        assert wind_to_category(95) == 2

    def test_wind_to_category_3_lower_bound(self) -> None:
        assert wind_to_category(96) == 3

    def test_wind_to_category_3_upper_bound(self) -> None:
        assert wind_to_category(112) == 3

    def test_wind_to_category_4_lower_bound(self) -> None:
        assert wind_to_category(113) == 4

    def test_wind_to_category_4_upper_bound(self) -> None:
        assert wind_to_category(136) == 4

    def test_wind_to_category_5_lower_bound(self) -> None:
        assert wind_to_category(137) == 5

    def test_wind_to_category_5_extreme(self) -> None:
        assert wind_to_category(200) == 5

    def test_wind_to_category_boundary_63(self) -> None:
        assert wind_to_category(63) == 0


# ---------------------------------------------------------------------------
# privacy.py — mask_email
# ---------------------------------------------------------------------------
from app.utils.privacy import mask_email


class TestMaskEmail:
    """Tests for email masking."""

    def test_mask_email_standard(self) -> None:
        assert mask_email("john@example.com") == "j***@example.com"

    def test_mask_email_single_char_local(self) -> None:
        assert mask_email("a@example.com") == "a***@example.com"

    def test_mask_email_no_at_sign(self) -> None:
        assert mask_email("not-an-email") == "***"

    def test_mask_email_empty_local(self) -> None:
        result = mask_email("@example.com")
        assert result == "***@example.com"

    def test_mask_email_multiple_at_signs(self) -> None:
        # rsplit on @, so "user@sub@domain.com" → local="user@sub", domain="domain.com"
        result = mask_email("user@sub@domain.com")
        assert result == "u***@domain.com"


# ---------------------------------------------------------------------------
# geojson.py — alert_to_feature, alerts_to_feature_collection,
#              storm_reports_to_feature_collection
# ---------------------------------------------------------------------------
from app.utils.geojson import (
    alert_to_feature,
    alerts_to_feature_collection,
    storm_reports_to_feature_collection,
)


class TestAlertToFeature:
    """Tests for alert → GeoJSON Feature conversion."""

    def test_alert_to_feature_valid(self) -> None:
        alert = {"latitude": 30.0, "longitude": -90.0, "event": "Tornado"}
        feature = alert_to_feature(alert)
        assert feature is not None
        assert feature["type"] == "Feature"
        assert feature["geometry"]["type"] == "Point"
        assert feature["geometry"]["coordinates"] == [-90.0, 30.0]
        assert feature["properties"]["event"] == "Tornado"
        assert "latitude" not in feature["properties"]
        assert "longitude" not in feature["properties"]

    def test_alert_to_feature_missing_lat(self) -> None:
        alert = {"longitude": -90.0}
        assert alert_to_feature(alert) is None

    def test_alert_to_feature_missing_lon(self) -> None:
        alert = {"latitude": 30.0}
        assert alert_to_feature(alert) is None

    def test_alert_to_feature_zero_lat(self) -> None:
        # lat=0 is falsy in Python but valid geographically.
        # The function checks ``if not lat`` so lat=0 will return None.
        alert = {"latitude": 0, "longitude": -90.0}
        result = alert_to_feature(alert)
        assert result is None  # current implementation uses `if not lat`

    def test_alert_to_feature_serialises_datetimes(self) -> None:
        dt = datetime(2025, 1, 15, 12, 0, tzinfo=timezone.utc)
        alert = {"latitude": 30.0, "longitude": -90.0, "event_time": dt}
        feature = alert_to_feature(alert)
        assert feature is not None
        assert isinstance(feature["properties"]["event_time"], str)


class TestAlertsToFeatureCollection:
    """Tests for alert list → GeoJSON FeatureCollection."""

    def test_empty_alerts(self) -> None:
        fc = alerts_to_feature_collection([])
        assert fc["type"] == "FeatureCollection"
        assert fc["features"] == []
        assert fc["metadata"]["count"] == 0

    def test_multiple_alerts(self) -> None:
        alerts = [
            {"latitude": 30.0, "longitude": -90.0, "event": "A"},
            {"latitude": 31.0, "longitude": -91.0, "event": "B"},
        ]
        fc = alerts_to_feature_collection(alerts)
        assert len(fc["features"]) == 2
        assert fc["metadata"]["count"] == 2
        assert fc["metadata"]["source"] == "NOAA NWS"

    def test_custom_source(self) -> None:
        fc = alerts_to_feature_collection([], source="Custom")
        assert fc["metadata"]["source"] == "Custom"

    def test_extra_metadata(self) -> None:
        fc = alerts_to_feature_collection(
            [], extra_metadata={"filter": "tornado"}
        )
        assert fc["metadata"]["filter"] == "tornado"

    def test_skips_invalid_alerts(self) -> None:
        alerts = [
            {"latitude": 30.0, "longitude": -90.0},
            {"latitude": None, "longitude": None},
        ]
        fc = alerts_to_feature_collection(alerts)
        assert fc["metadata"]["count"] == 1


class TestStormReportsToFeatureCollection:
    """Tests for storm reports → GeoJSON FeatureCollection."""

    def test_empty_reports(self) -> None:
        fc = storm_reports_to_feature_collection({})
        assert fc["type"] == "FeatureCollection"
        assert fc["features"] == []
        assert fc["metadata"]["count"] == 0
        assert fc["metadata"]["source"] == "NOAA SPC"

    def test_multiple_report_types(self) -> None:
        reports = {
            "tornadoes": [
                {"latitude": 30.0, "longitude": -90.0, "ef_scale": 3},
            ],
            "hail": [
                {"latitude": 31.0, "longitude": -91.0, "size": 1.5},
                {"latitude": 32.0, "longitude": -92.0, "size": 2.0},
            ],
        }
        fc = storm_reports_to_feature_collection(reports)
        assert len(fc["features"]) == 3
        assert fc["metadata"]["count"] == 3
        assert fc["metadata"]["breakdown"]["tornadoes"] == 1
        assert fc["metadata"]["breakdown"]["hail"] == 2

    def test_report_type_in_properties(self) -> None:
        reports = {
            "wind": [{"latitude": 30.0, "longitude": -90.0, "speed": 60}],
        }
        fc = storm_reports_to_feature_collection(reports)
        assert fc["features"][0]["properties"]["report_type"] == "wind"
        assert fc["features"][0]["properties"]["speed"] == 60

    def test_skips_missing_coordinates(self) -> None:
        reports = {
            "tornadoes": [
                {"latitude": None, "longitude": None},
                {"latitude": 30.0, "longitude": -90.0},
            ],
        }
        fc = storm_reports_to_feature_collection(reports)
        assert fc["metadata"]["count"] == 1


# ---------------------------------------------------------------------------
# cache.py — TTLCache
# ---------------------------------------------------------------------------
from app.utils.cache import TTLCache


class TestTTLCache:
    """Tests for the simple TTL cache."""

    def test_set_and_get(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("key1", "value1")
        assert cache.get("key1") == "value1"

    def test_get_missing_key(self) -> None:
        cache = TTLCache()
        assert cache.get("nope") is None

    def test_ttl_expiry(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=0)
        cache.set("key", "val")
        # ttl=0 means already expired on next access
        time.sleep(0.01)
        assert cache.get("key") is None

    def test_max_size_eviction(self) -> None:
        cache = TTLCache(max_size=2, ttl_seconds=60)
        cache.set("a", 1)
        cache.set("b", 2)
        cache.set("c", 3)
        # "a" should be evicted (oldest)
        assert cache.get("a") is None
        assert cache.get("b") == 2
        assert cache.get("c") == 3

    def test_overwrite_existing_key(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("k", "old")
        cache.set("k", "new")
        assert cache.get("k") == "new"

    def test_clear(self) -> None:
        cache = TTLCache()
        cache.set("a", 1)
        cache.set("b", 2)
        cache.clear()
        assert cache.get("a") is None
        assert len(cache) == 0

    def test_contains(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        cache.set("x", 42)
        assert "x" in cache
        assert "y" not in cache

    def test_len(self) -> None:
        cache = TTLCache(max_size=10, ttl_seconds=60)
        assert len(cache) == 0
        cache.set("a", 1)
        cache.set("b", 2)
        assert len(cache) == 2

    def test_lru_move_to_end(self) -> None:
        cache = TTLCache(max_size=2, ttl_seconds=60)
        cache.set("a", 1)
        cache.set("b", 2)
        # Access "a" to move it to end (most recent)
        cache.get("a")
        # Now add "c" — "b" should be evicted because it is oldest
        cache.set("c", 3)
        assert cache.get("a") == 1
        assert cache.get("b") is None
        assert cache.get("c") == 3
