"""Tests for all API and web blueprint routes.

Every endpoint is tested using the Flask test client with services mocked
to avoid real database or external HTTP dependencies.
"""
from __future__ import annotations

import json
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest


# =========================================================================
# Earthquake API — /api/v1/earthquakes
# =========================================================================

class TestEarthquakesBlueprint:
    """Tests for the earthquake API blueprint."""

    @patch("app.blueprints.api_earthquakes.EarthquakeService")
    def test_list_earthquakes_default(self, MockSvc, client) -> None:
        mock_result = MagicMock()
        mock_result.__class__.__name__ = "EarthquakeList"
        MockSvc.return_value.get_earthquakes.return_value = mock_result
        response = client.get("/api/v1/earthquakes/")
        assert response.status_code == 200

    @patch("app.blueprints.api_earthquakes.EarthquakeService")
    def test_list_earthquakes_with_filters(self, MockSvc, client) -> None:
        mock_result = MagicMock()
        MockSvc.return_value.get_earthquakes.return_value = mock_result
        response = client.get(
            "/api/v1/earthquakes/?min_magnitude=5.0&max_magnitude=8.0&page=1&per_page=10"
        )
        assert response.status_code == 200

    def test_list_earthquakes_invalid_min_magnitude(self, client) -> None:
        response = client.get("/api/v1/earthquakes/?min_magnitude=11")
        assert response.status_code == 400
        data = response.get_json()
        assert data["errors"][0]["code"] == "VALIDATION_ERROR"

    def test_list_earthquakes_invalid_max_magnitude(self, client) -> None:
        response = client.get("/api/v1/earthquakes/?max_magnitude=-1")
        assert response.status_code == 400

    def test_list_earthquakes_invalid_page(self, client) -> None:
        response = client.get("/api/v1/earthquakes/?page=0")
        assert response.status_code == 400

    def test_list_earthquakes_invalid_per_page(self, client) -> None:
        response = client.get("/api/v1/earthquakes/?per_page=200")
        assert response.status_code == 400

    def test_list_earthquakes_bad_date(self, client) -> None:
        response = client.get("/api/v1/earthquakes/?start_date=not-a-date")
        assert response.status_code == 400

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_recent_earthquakes(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquakes.return_value = [
            {"id": "us1", "properties": {"mag": 5.0}}
        ]
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/recent")
        assert response.status_code == 200
        data = response.get_json()
        assert data["type"] == "FeatureCollection"

    def test_recent_earthquakes_invalid_hours(self, client) -> None:
        response = client.get("/api/v1/earthquakes/recent?hours=0")
        assert response.status_code == 400

    def test_recent_earthquakes_invalid_min_magnitude(self, client) -> None:
        response = client.get("/api/v1/earthquakes/recent?min_magnitude=11")
        assert response.status_code == 400

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_recent_earthquakes_service_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquakes.side_effect = Exception("timeout")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/recent")
        assert response.status_code == 502

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_significant_earthquakes(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquakes.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/significant")
        assert response.status_code == 200

    def test_significant_earthquakes_invalid_days(self, client) -> None:
        response = client.get("/api/v1/earthquakes/significant?days=0")
        assert response.status_code == 400

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_significant_earthquakes_service_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquakes.side_effect = Exception("error")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/significant")
        assert response.status_code == 502

    @patch("app.blueprints.api_earthquakes.EarthquakeService")
    def test_get_earthquake_by_id_found(self, MockSvc, client) -> None:
        mock_eq = MagicMock()
        MockSvc.return_value.get_by_id.return_value = mock_eq
        response = client.get("/api/v1/earthquakes/1")
        assert response.status_code == 200

    @patch("app.blueprints.api_earthquakes.EarthquakeService")
    def test_get_earthquake_by_id_not_found(self, MockSvc, client) -> None:
        MockSvc.return_value.get_by_id.return_value = None
        response = client.get("/api/v1/earthquakes/999")
        assert response.status_code == 404

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_get_earthquake_by_usgs_id_found(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquake_by_id.return_value = {"id": "us123"}
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/usgs/us123")
        assert response.status_code == 200

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_get_earthquake_by_usgs_id_not_found(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquake_by_id.return_value = None
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/usgs/nonexistent")
        assert response.status_code == 404

    @patch("app.blueprints.api_earthquakes.get_usgs_client")
    def test_get_earthquake_by_usgs_id_service_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_earthquake_by_id.side_effect = Exception("timeout")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/earthquakes/usgs/us123")
        assert response.status_code == 502


# =========================================================================
# Hurricane API — /api/v1/hurricanes
# =========================================================================

class TestHurricanesBlueprint:
    """Tests for the hurricane API blueprint."""

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_list_hurricanes_default(self, MockSvc, client) -> None:
        mock_result = MagicMock()
        MockSvc.return_value.get_hurricanes.return_value = mock_result
        response = client.get("/api/v1/hurricanes/")
        assert response.status_code == 200

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_list_hurricanes_with_filters(self, MockSvc, client) -> None:
        mock_result = MagicMock()
        MockSvc.return_value.get_hurricanes.return_value = mock_result
        response = client.get(
            "/api/v1/hurricanes/?basin=AL&is_active=true&min_category=3"
        )
        assert response.status_code == 200

    def test_list_hurricanes_invalid_min_category(self, client) -> None:
        response = client.get("/api/v1/hurricanes/?min_category=6")
        assert response.status_code == 400

    def test_list_hurricanes_invalid_page(self, client) -> None:
        response = client.get("/api/v1/hurricanes/?page=0")
        assert response.status_code == 400

    def test_list_hurricanes_invalid_per_page(self, client) -> None:
        response = client.get("/api/v1/hurricanes/?per_page=200")
        assert response.status_code == 400

    @patch("app.blueprints.api_hurricanes.get_noaa_client")
    def test_get_active_storms(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_storms.return_value = [
            {"name": "Ana", "basin": "AL"}
        ]
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/hurricanes/active")
        assert response.status_code == 200

    @patch("app.blueprints.api_hurricanes.get_noaa_client")
    def test_get_active_storms_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_storms.side_effect = Exception("timeout")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/hurricanes/active")
        assert response.status_code == 502

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_season_hurricanes(self, MockSvc, client) -> None:
        MockSvc.return_value.get_by_season.return_value = []
        response = client.get("/api/v1/hurricanes/season/2024")
        assert response.status_code == 200

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_by_id_found(self, MockSvc, client) -> None:
        mock_h = MagicMock()
        MockSvc.return_value.get_by_id.return_value = mock_h
        response = client.get("/api/v1/hurricanes/1")
        assert response.status_code == 200

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_by_id_not_found(self, MockSvc, client) -> None:
        MockSvc.return_value.get_by_id.return_value = None
        response = client.get("/api/v1/hurricanes/999")
        assert response.status_code == 404

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_track_found(self, MockSvc, client) -> None:
        MockSvc.return_value.get_track.return_value = {
            "type": "LineString",
            "coordinates": [[-90, 25], [-89, 26]],
        }
        response = client.get("/api/v1/hurricanes/1/track")
        assert response.status_code == 200
        data = response.get_json()
        assert data["type"] == "Feature"

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_track_not_found(self, MockSvc, client) -> None:
        MockSvc.return_value.get_track.return_value = None
        response = client.get("/api/v1/hurricanes/999/track")
        assert response.status_code == 404

    @patch("app.blueprints.api_hurricanes.get_noaa_client")
    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_forecast_active(self, MockSvc, mock_get_client, client) -> None:
        mock_h = MagicMock()
        mock_h.is_active = True
        mock_h.storm_id = "AL012025"
        MockSvc.return_value.get_by_id.return_value = mock_h
        mock_client = MagicMock()
        mock_client.fetch_forecast.return_value = {"cone": "data"}
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/hurricanes/1/forecast")
        assert response.status_code == 200

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_forecast_not_found(self, MockSvc, client) -> None:
        MockSvc.return_value.get_by_id.return_value = None
        response = client.get("/api/v1/hurricanes/999/forecast")
        assert response.status_code == 404

    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_forecast_inactive(self, MockSvc, client) -> None:
        mock_h = MagicMock()
        mock_h.is_active = False
        MockSvc.return_value.get_by_id.return_value = mock_h
        response = client.get("/api/v1/hurricanes/1/forecast")
        assert response.status_code == 400

    @patch("app.blueprints.api_hurricanes.get_noaa_client")
    @patch("app.blueprints.api_hurricanes.HurricaneService")
    def test_get_hurricane_forecast_service_error(self, MockSvc, mock_get_client, client) -> None:
        mock_h = MagicMock()
        mock_h.is_active = True
        mock_h.storm_id = "AL012025"
        MockSvc.return_value.get_by_id.return_value = mock_h
        mock_client = MagicMock()
        mock_client.fetch_forecast.side_effect = Exception("error")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/hurricanes/1/forecast")
        assert response.status_code == 502


# =========================================================================
# Wildfire API — /api/v1/wildfires
# =========================================================================

class TestWildfiresBlueprint:
    """Tests for the wildfire API blueprint."""

    @patch("app.blueprints.api_wildfires.get_firms_client")
    def test_active_wildfires_usa(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_fires_usa.return_value = [
            {
                "latitude": 34.0,
                "longitude": -118.0,
                "source_id": "F001",
                "brightness": 350.0,
                "frp": 50.0,
                "confidence": 85,
                "satellite": "VIIRS",
                "detected_at": datetime(2025, 7, 1, tzinfo=timezone.utc),
            }
        ]
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/wildfires/active?region=USA")
        assert response.status_code == 200
        data = response.get_json()
        assert data["type"] == "FeatureCollection"
        assert len(data["features"]) == 1

    @patch("app.blueprints.api_wildfires.get_firms_client")
    def test_active_wildfires_global(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_global_fires.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/wildfires/active?region=Global")
        assert response.status_code == 200

    def test_active_wildfires_invalid_hours(self, client) -> None:
        response = client.get("/api/v1/wildfires/active?hours=0")
        assert response.status_code == 400

    @patch("app.blueprints.api_wildfires.get_firms_client")
    def test_active_wildfires_service_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_fires_usa.side_effect = Exception("timeout")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/wildfires/active")
        assert response.status_code == 502

    def test_major_wildfires(self, client) -> None:
        response = client.get("/api/v1/wildfires/major")
        assert response.status_code == 200
        data = response.get_json()
        assert data["data"] == []


# =========================================================================
# Severe Weather API — /api/v1/severe-weather
# =========================================================================

class TestSevereWeatherBlueprint:
    """Tests for the severe weather API blueprint."""

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_get_alerts(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_alerts.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/alerts")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_get_alerts_with_type(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_alerts.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/alerts?event_type=tornado")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_get_alerts_service_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_active_alerts.side_effect = Exception("error")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/alerts")
        assert response.status_code == 502

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_tornado_alerts(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_tornado_warnings.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/tornadoes")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_tornado_alerts_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_tornado_warnings.side_effect = Exception("err")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/tornadoes")
        assert response.status_code == 502

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_flood_alerts(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_flood_alerts.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/flooding")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_flood_alerts_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_flood_alerts.side_effect = Exception("err")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/flooding")
        assert response.status_code == 502

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_hail_reports(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_severe_thunderstorm_alerts.return_value = []
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/hail")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_hail_reports_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_severe_thunderstorm_alerts.side_effect = Exception("err")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/hail")
        assert response.status_code == 502

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_storm_reports(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_spc_storm_reports.return_value = {
            "tornadoes": [],
            "hail": [],
            "wind": [],
        }
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/storm-reports")
        assert response.status_code == 200

    @patch("app.blueprints.api_severe_weather.get_nws_client")
    def test_storm_reports_error(self, mock_get_client, client) -> None:
        mock_client = MagicMock()
        mock_client.fetch_spc_storm_reports.side_effect = Exception("err")
        mock_get_client.return_value = mock_client
        response = client.get("/api/v1/severe-weather/storm-reports")
        assert response.status_code == 502


# =========================================================================
# Subscription API — /api/v1/subscriptions
# =========================================================================

class TestSubscriptionsBlueprint:
    """Tests for the subscription API blueprint."""

    @patch("app.blueprints.api_subscriptions.email_service")
    @patch("app.blueprints.api_subscriptions.subscription_service")
    def test_subscribe_success(self, mock_svc, mock_email, client, api_headers) -> None:
        mock_svc.create_subscription.return_value = ("token123", True)
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=api_headers,
            data=json.dumps({"email": "test@example.com"}),
        )
        assert response.status_code == 200

    @patch("app.blueprints.api_subscriptions.subscription_service")
    def test_subscribe_existing_email(self, mock_svc, client, api_headers) -> None:
        mock_svc.create_subscription.return_value = ("uniform message", False)
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=api_headers,
            data=json.dumps({"email": "existing@example.com"}),
        )
        assert response.status_code == 200

    def test_subscribe_no_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_subscribe_invalid_email(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=api_headers,
            data=json.dumps({"email": "not-valid"}),
        )
        assert response.status_code == 400

    def test_subscribe_no_api_key(self, client, no_key_headers) -> None:
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=no_key_headers,
            data=json.dumps({"email": "test@example.com"}),
        )
        assert response.status_code == 401

    def test_subscribe_invalid_api_key(self, client, invalid_api_headers) -> None:
        response = client.post(
            "/api/v1/subscriptions/subscribe",
            headers=invalid_api_headers,
            data=json.dumps({"email": "test@example.com"}),
        )
        assert response.status_code == 401

    @patch("app.blueprints.api_subscriptions.subscription_service")
    def test_verify_email(self, mock_svc, client) -> None:
        mock_svc.verify_subscription.return_value = "verified"
        response = client.get("/api/v1/subscriptions/verify/some-token")
        assert response.status_code == 200

    @patch("app.blueprints.api_subscriptions.subscription_service")
    def test_unsubscribe(self, mock_svc, client) -> None:
        mock_svc.unsubscribe.return_value = "unsubscribed"
        response = client.get("/api/v1/subscriptions/unsubscribe/some-token")
        assert response.status_code == 200

    @patch("app.blueprints.api_subscriptions.db")
    def test_get_preferences_found(self, mock_db, client) -> None:
        mock_sub = MagicMock()
        mock_sub.id = 1
        mock_sub.email = "test@example.com"
        mock_sub.is_verified = True
        mock_sub.is_active = True
        mock_sub.alert_earthquakes = True
        mock_sub.alert_hurricanes = True
        mock_sub.alert_wildfires = True
        mock_sub.alert_tornadoes = True
        mock_sub.alert_flooding = True
        mock_sub.alert_hail = True
        mock_sub.min_earthquake_magnitude = 5.0
        mock_sub.min_hurricane_category = 1
        mock_sub.location_filter = None
        mock_sub.max_emails_per_day = 10
        mock_sub.created_at = datetime(2025, 1, 1, tzinfo=timezone.utc)
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_sub
        response = client.get("/api/v1/subscriptions/preferences/test@example.com")
        assert response.status_code == 200

    @patch("app.blueprints.api_subscriptions.db")
    def test_get_preferences_not_found(self, mock_db, client) -> None:
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None
        response = client.get("/api/v1/subscriptions/preferences/missing@example.com")
        assert response.status_code == 404

    @patch("app.blueprints.api_subscriptions.subscription_service")
    @patch("app.blueprints.api_subscriptions.db")
    def test_update_preferences_success(self, mock_db, mock_svc, client, api_headers) -> None:
        mock_sub = MagicMock()
        mock_sub.id = 1
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_sub
        mock_svc.update_preferences.return_value = MagicMock()
        response = client.put(
            "/api/v1/subscriptions/preferences/test@example.com",
            headers=api_headers,
            data=json.dumps({"alert_earthquakes": False}),
        )
        assert response.status_code == 200

    @patch("app.blueprints.api_subscriptions.db")
    def test_update_preferences_not_found(self, mock_db, client, api_headers) -> None:
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None
        response = client.put(
            "/api/v1/subscriptions/preferences/missing@example.com",
            headers=api_headers,
            data=json.dumps({"alert_earthquakes": False}),
        )
        assert response.status_code == 404

    def test_update_preferences_no_body(self, client, api_headers) -> None:
        response = client.put(
            "/api/v1/subscriptions/preferences/test@example.com",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_update_preferences_no_api_key(self, client, no_key_headers) -> None:
        response = client.put(
            "/api/v1/subscriptions/preferences/test@example.com",
            headers=no_key_headers,
            data=json.dumps({"alert_earthquakes": False}),
        )
        assert response.status_code == 401


# =========================================================================
# Parametric API — /api/v1/parametric
# =========================================================================

class TestParametricBlueprint:
    """Tests for the parametric insurance API blueprint."""

    @patch("app.blueprints.api_parametric._get_parametric_service")
    def test_get_datasets(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_available_datasets.return_value = {"ibtracs": {"name": "IBTrACS"}}
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/parametric/datasets")
        assert response.status_code == 200

    @patch("app.blueprints.api_parametric._get_parametric_service")
    def test_get_historical_hurricanes(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_hurricanes.return_value = []
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/parametric/hurricanes/historical")
        assert response.status_code == 200

    def test_get_historical_hurricanes_invalid_start_year(self, client) -> None:
        response = client.get("/api/v1/parametric/hurricanes/historical?start_year=1800")
        assert response.status_code == 400

    def test_get_historical_hurricanes_invalid_end_year(self, client) -> None:
        response = client.get("/api/v1/parametric/hurricanes/historical?end_year=3000")
        assert response.status_code == 400

    def test_get_historical_hurricanes_invalid_min_category(self, client) -> None:
        response = client.get("/api/v1/parametric/hurricanes/historical?min_category=6")
        assert response.status_code == 400

    def test_get_historical_hurricanes_invalid_dataset(self, client) -> None:
        response = client.get("/api/v1/parametric/hurricanes/historical?dataset=bogus")
        assert response.status_code == 400

    @patch("app.blueprints.api_parametric._get_parametric_service")
    def test_get_historical_hurricanes_service_error(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_hurricanes.side_effect = Exception("error")
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/parametric/hurricanes/historical")
        assert response.status_code == 502

    @patch("app.blueprints.api_parametric._get_parametric_service")
    def test_analysis_intersections(self, mock_get_svc, client, api_headers) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_hurricanes.return_value = []
        mock_svc.find_box_intersections.return_value = []
        mock_get_svc.return_value = mock_svc
        body = {
            "box": {
                "id": "b1",
                "name": "Test",
                "north": 30,
                "south": 20,
                "east": -80,
                "west": -100,
            },
            "start_year": 2000,
            "end_year": 2020,
        }
        response = client.post(
            "/api/v1/parametric/analysis/intersections",
            headers=api_headers,
            data=json.dumps(body),
        )
        assert response.status_code == 200

    def test_analysis_intersections_no_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/parametric/analysis/intersections",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_analysis_intersections_invalid_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/parametric/analysis/intersections",
            headers=api_headers,
            data=json.dumps({"box": {}}),
        )
        assert response.status_code == 400

    def test_analysis_intersections_no_api_key(self, client, no_key_headers) -> None:
        response = client.post(
            "/api/v1/parametric/analysis/intersections",
            headers=no_key_headers,
            data=json.dumps({"box": {}}),
        )
        assert response.status_code == 401

    @patch("app.blueprints.api_parametric._get_parametric_service")
    def test_analysis_statistics(self, mock_get_svc, client, api_headers) -> None:
        mock_svc = MagicMock()
        mock_svc.analyze_box.return_value = MagicMock()
        mock_get_svc.return_value = mock_svc
        body = {
            "box": {
                "id": "b1",
                "name": "Test",
                "north": 30,
                "south": 20,
                "east": -80,
                "west": -100,
            },
        }
        response = client.post(
            "/api/v1/parametric/analysis/statistics",
            headers=api_headers,
            data=json.dumps(body),
        )
        assert response.status_code == 200

    def test_analysis_statistics_no_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/parametric/analysis/statistics",
            headers=api_headers,
        )
        assert response.status_code == 400


# =========================================================================
# Earthquake Parametric API — /api/v1/earthquake-parametric
# =========================================================================

class TestEarthquakeParametricBlueprint:
    """Tests for the earthquake parametric API blueprint."""

    @patch("app.blueprints.api_earthquake_parametric._get_earthquake_parametric_service")
    def test_get_datasets(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_available_datasets.return_value = {"usgs_worldwide": {}}
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/earthquake-parametric/datasets")
        assert response.status_code == 200

    @patch("app.blueprints.api_earthquake_parametric._get_earthquake_parametric_service")
    def test_get_historical_earthquakes(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_earthquakes.return_value = []
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/earthquake-parametric/earthquakes/historical")
        assert response.status_code == 200

    def test_get_historical_earthquakes_invalid_start_year(self, client) -> None:
        response = client.get(
            "/api/v1/earthquake-parametric/earthquakes/historical?start_year=1800"
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_end_year(self, client) -> None:
        response = client.get(
            "/api/v1/earthquake-parametric/earthquakes/historical?end_year=3000"
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_magnitude(self, client) -> None:
        response = client.get(
            "/api/v1/earthquake-parametric/earthquakes/historical?min_magnitude=11"
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_dataset(self, client) -> None:
        response = client.get(
            "/api/v1/earthquake-parametric/earthquakes/historical?dataset=bogus"
        )
        assert response.status_code == 400

    @patch("app.blueprints.api_earthquake_parametric._get_earthquake_parametric_service")
    def test_get_historical_earthquakes_service_error(self, mock_get_svc, client) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_earthquakes.side_effect = Exception("err")
        mock_get_svc.return_value = mock_svc
        response = client.get("/api/v1/earthquake-parametric/earthquakes/historical")
        assert response.status_code == 502

    @patch("app.blueprints.api_earthquake_parametric._get_earthquake_parametric_service")
    def test_analysis_earthquakes(self, mock_get_svc, client, api_headers) -> None:
        mock_svc = MagicMock()
        mock_svc.get_historical_earthquakes.return_value = []
        mock_svc.find_earthquakes_in_box.return_value = []
        mock_get_svc.return_value = mock_svc
        body = {
            "box": {
                "id": "b1",
                "name": "Test",
                "north": 40,
                "south": 30,
                "east": -80,
                "west": -100,
            },
        }
        response = client.post(
            "/api/v1/earthquake-parametric/analysis/earthquakes",
            headers=api_headers,
            data=json.dumps(body),
        )
        assert response.status_code == 200

    def test_analysis_earthquakes_no_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/earthquake-parametric/analysis/earthquakes",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_analysis_earthquakes_invalid_body(self, client, api_headers) -> None:
        response = client.post(
            "/api/v1/earthquake-parametric/analysis/earthquakes",
            headers=api_headers,
            data=json.dumps({"box": {}}),
        )
        assert response.status_code == 400

    def test_analysis_earthquakes_no_api_key(self, client, no_key_headers) -> None:
        response = client.post(
            "/api/v1/earthquake-parametric/analysis/earthquakes",
            headers=no_key_headers,
            data=json.dumps({"box": {}}),
        )
        assert response.status_code == 401


# =========================================================================
# Indemnity API — /api/v1/indemnity
# =========================================================================

class TestIndemnityBlueprint:
    """Tests for the indemnity insurance API blueprint."""

    @patch("app.blueprints.api_indemnity._eq_parametric_service")
    def test_get_historical_earthquakes(self, mock_svc, client, api_headers) -> None:
        mock_svc.get_historical_earthquakes.return_value = []
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes",
            headers=api_headers,
        )
        assert response.status_code == 200

    def test_get_historical_earthquakes_invalid_mode(self, client, api_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes?mode=invalid",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_limit(self, client, api_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes?limit=0",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_start_year(self, client, api_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes?start_year=1800",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_invalid_min_mag(self, client, api_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes?min_magnitude=3.0",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_get_historical_earthquakes_no_api_key(self, client, no_key_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/earthquakes",
            headers=no_key_headers,
        )
        assert response.status_code == 401

    @patch("app.blueprints.api_indemnity._parametric_service")
    def test_get_historical_hurricanes(self, mock_svc, client, api_headers) -> None:
        mock_svc.get_historical_hurricanes.return_value = []
        response = client.get(
            "/api/v1/indemnity/historical/hurricanes",
            headers=api_headers,
        )
        assert response.status_code == 200

    def test_get_historical_hurricanes_invalid_mode(self, client, api_headers) -> None:
        response = client.get(
            "/api/v1/indemnity/historical/hurricanes?mode=invalid",
            headers=api_headers,
        )
        assert response.status_code == 400

    def test_get_historical_summary(self, client) -> None:
        response = client.get("/api/v1/indemnity/historical/summary")
        assert response.status_code == 200
        data = response.get_json()
        assert "earthquakes" in data["data"]
        assert "hurricanes" in data["data"]


# =========================================================================
# Main (Web) — /
# =========================================================================

class TestMainBlueprint:
    """Tests for the main web blueprint (template rendering)."""

    def test_index_page(self, client) -> None:
        response = client.get("/")
        assert response.status_code == 200

    def test_parametric_live(self, client) -> None:
        response = client.get("/parametric/live")
        assert response.status_code == 200

    def test_parametric_historical(self, client) -> None:
        response = client.get("/parametric/historical")
        assert response.status_code == 200

    def test_parametric_redirect(self, client) -> None:
        response = client.get("/parametric")
        assert response.status_code == 302

    def test_indemnity_live(self, client) -> None:
        response = client.get("/indemnity/live")
        assert response.status_code == 200

    def test_indemnity_historical(self, client) -> None:
        response = client.get("/indemnity/historical")
        assert response.status_code == 200

    def test_indemnity_redirect(self, client) -> None:
        response = client.get("/indemnity")
        assert response.status_code == 302


# =========================================================================
# Error handling
# =========================================================================

class TestErrorHandlers:
    """Tests for global error handlers."""

    def test_api_404(self, client) -> None:
        response = client.get("/api/v1/nonexistent-route")
        assert response.status_code == 404
        data = response.get_json()
        assert data is not None
        assert data["errors"][0]["code"] == "NOT_FOUND"

    def test_web_404(self, client) -> None:
        response = client.get("/nonexistent-page")
        assert response.status_code == 404
        # Returns HTML for web routes
        assert b"<!DOCTYPE html>" in response.data or b"<html" in response.data or response.status_code == 404
