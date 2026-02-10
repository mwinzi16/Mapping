"""Tests for service modules (mocked DB and HTTP dependencies)."""
from __future__ import annotations

import math
from datetime import datetime, timezone
from unittest.mock import MagicMock, patch

import pytest

# ---------------------------------------------------------------------------
# IndemnityService — pure functions
# ---------------------------------------------------------------------------
from app.services.indemnity_service import (
    calculate_earthquake_significance,
    calculate_hurricane_significance,
)


class TestCalculateEarthquakeSignificance:
    """Tests for earthquake significance scoring (pure function)."""

    def test_high_magnitude_shallow(self) -> None:
        score = calculate_earthquake_significance(
            {"magnitude": 9.0, "depth_km": 10, "significance": 1000}
        )
        assert 80 <= score <= 100

    def test_low_magnitude_deep(self) -> None:
        score = calculate_earthquake_significance(
            {"magnitude": 3.0, "depth_km": 400, "significance": 50}
        )
        assert score < 20

    def test_zero_depth(self) -> None:
        score = calculate_earthquake_significance(
            {"magnitude": 5.0, "depth_km": 0, "significance": 0}
        )
        # depth_score should be 25 (max for shallow)
        assert score > 0

    def test_intermediate_depth(self) -> None:
        score1 = calculate_earthquake_significance(
            {"magnitude": 6.0, "depth_km": 50, "significance": 500}
        )
        score2 = calculate_earthquake_significance(
            {"magnitude": 6.0, "depth_km": 200, "significance": 500}
        )
        assert score1 > score2

    def test_missing_fields_use_defaults(self) -> None:
        score = calculate_earthquake_significance({})
        assert score == 0.0 or score >= 0

    def test_score_bounded_0_100(self) -> None:
        score = calculate_earthquake_significance(
            {"magnitude": 9.5, "depth_km": 0, "significance": 2000}
        )
        assert 0 <= score <= 100

    def test_very_deep_earthquake(self) -> None:
        score = calculate_earthquake_significance(
            {"magnitude": 5.0, "depth_km": 600, "significance": 0}
        )
        # Depth score should be 0 for > 300 km
        assert score >= 0


class TestCalculateHurricaneSignificance:
    """Tests for hurricane significance scoring (pure function)."""

    def test_category_5(self) -> None:
        score = calculate_hurricane_significance(
            {"max_category": 5, "max_wind_mph": 175, "min_pressure_mb": 900}
        )
        assert 80 <= score <= 100

    def test_tropical_storm(self) -> None:
        score = calculate_hurricane_significance(
            {"max_category": 0, "max_wind_mph": 50, "min_pressure_mb": 1000}
        )
        assert score < 30

    def test_no_pressure_data(self) -> None:
        score = calculate_hurricane_significance(
            {"max_category": 3, "max_wind_mph": 120}
        )
        assert score > 0

    def test_pressure_zero(self) -> None:
        score = calculate_hurricane_significance(
            {"max_category": 3, "max_wind_mph": 120, "min_pressure_mb": 0}
        )
        # pressure > 0 check fails, so pressure_score = 0
        assert score > 0

    def test_category_key_fallback(self) -> None:
        score = calculate_hurricane_significance(
            {"category": 4, "max_wind_mph": 150}
        )
        assert score > 40

    def test_score_bounded_0_100(self) -> None:
        score = calculate_hurricane_significance(
            {"max_category": 5, "max_wind_mph": 200, "min_pressure_mb": 870}
        )
        assert 0 <= score <= 100


# ---------------------------------------------------------------------------
# ParametricService — geometry helpers
# ---------------------------------------------------------------------------
from app.schemas.parametric import (
    BoundingBox,
    BoxStatistics,
    HistoricalHurricane,
    HistoricalHurricaneSummary,
    HurricaneTrackPoint,
    TriggerCriteria,
)
from app.services.parametric_service import ParametricService, _segments_intersect


class TestPointInBox:
    """Tests for ParametricService._point_in_box."""

    def test_point_inside(self) -> None:
        box = BoundingBox(id="b", name="B", north=30, south=20, east=-80, west=-100)
        assert ParametricService._point_in_box(25, -90, box) is True

    def test_point_outside(self) -> None:
        box = BoundingBox(id="b", name="B", north=30, south=20, east=-80, west=-100)
        assert ParametricService._point_in_box(35, -90, box) is False

    def test_point_on_boundary(self) -> None:
        box = BoundingBox(id="b", name="B", north=30, south=20, east=-80, west=-100)
        assert ParametricService._point_in_box(30, -80, box) is True


class TestSegmentIntersectsBox:
    """Tests for ParametricService._segment_intersects_box."""

    def test_segment_crosses_box(self) -> None:
        box = BoundingBox(id="b", name="B", north=30, south=20, east=-80, west=-100)
        # Segment from (15, -90) to (35, -90) crosses south and north edges
        assert ParametricService._segment_intersects_box(15, -90, 35, -90, box) is True

    def test_segment_misses_box(self) -> None:
        box = BoundingBox(id="b", name="B", north=30, south=20, east=-80, west=-100)
        # Segment far outside
        assert ParametricService._segment_intersects_box(40, -90, 50, -90, box) is False


class TestSegmentsIntersect:
    """Tests for the module-level _segments_intersect helper."""

    def test_crossing_segments(self) -> None:
        assert _segments_intersect(0, 0, 10, 10, 0, 10, 10, 0) is True

    def test_parallel_segments(self) -> None:
        assert _segments_intersect(0, 0, 10, 0, 0, 5, 10, 5) is False

    def test_non_crossing(self) -> None:
        assert _segments_intersect(0, 0, 5, 0, 6, 1, 10, 1) is False


class TestFindBoxIntersections:
    """Tests for ParametricService.find_box_intersections."""

    def _make_hurricane(self, track_points: list[tuple]) -> HistoricalHurricane:
        track = [
            HurricaneTrackPoint(
                timestamp=datetime(2020, 9, 1, h, tzinfo=timezone.utc),
                latitude=lat,
                longitude=lon,
                wind_knots=100,
                pressure_mb=950,
                category=3,
                status="HU",
            )
            for h, (lat, lon) in enumerate(track_points)
        ]
        return HistoricalHurricane(
            storm_id="AL012020",
            name="TestStorm",
            year=2020,
            basin="NA",
            max_category=3,
            max_wind_knots=100,
            track=track,
            start_date=datetime(2020, 9, 1, tzinfo=timezone.utc),
            end_date=datetime(2020, 9, 2, tzinfo=timezone.utc),
        )

    def test_track_passes_through_box(self) -> None:
        svc = ParametricService.__new__(ParametricService)
        box = BoundingBox(id="b1", name="Gulf", north=30, south=20, east=-80, west=-100)
        hurricane = self._make_hurricane([(15, -90), (25, -90), (35, -90)])
        intersections = svc.find_box_intersections([hurricane], box)
        assert len(intersections) == 1
        assert intersections[0].box_id == "b1"

    def test_track_misses_box(self) -> None:
        svc = ParametricService.__new__(ParametricService)
        box = BoundingBox(id="b1", name="Gulf", north=30, south=20, east=-80, west=-100)
        hurricane = self._make_hurricane([(40, -90), (45, -90)])
        intersections = svc.find_box_intersections([hurricane], box)
        assert len(intersections) == 0


class TestFilterByTriggerCriteria:
    """Tests for ParametricService.filter_by_trigger_criteria."""

    def test_filter_with_none_trigger(self) -> None:
        svc = ParametricService.__new__(ParametricService)
        intersections = [MagicMock()]
        result = svc.filter_by_trigger_criteria(intersections, trigger=None)
        assert len(result) == 1

    def test_filter_removes_non_qualifying(self) -> None:
        svc = ParametricService.__new__(ParametricService)
        trigger = TriggerCriteria(min_category=3)

        ix_pass = MagicMock()
        ix_pass.category_at_crossing = 4
        ix_pass.entry_point.wind_knots = 130
        ix_pass.entry_point.pressure_mb = 940

        ix_fail = MagicMock()
        ix_fail.category_at_crossing = 1
        ix_fail.entry_point.wind_knots = 70
        ix_fail.entry_point.pressure_mb = 1000

        result = svc.filter_by_trigger_criteria([ix_pass, ix_fail], trigger)
        assert len(result) == 1


class TestCalculateStatistics:
    """Tests for ParametricService.calculate_statistics."""

    def test_empty_intersections(self) -> None:
        svc = ParametricService.__new__(ParametricService)
        box = BoundingBox(id="b1", name="Gulf", north=30, south=20, east=-80, west=-100)
        stats = svc.calculate_statistics([], box, 1980, 2024)
        assert stats.total_hurricanes == 0
        assert stats.trigger_probability == 0.0
        assert stats.years_analyzed == 45


# ---------------------------------------------------------------------------
# EarthquakeParametricService
# ---------------------------------------------------------------------------
from app.schemas.earthquake_parametric import (
    EarthquakeBoundingBox,
    EarthquakeTriggerCriteria,
    HistoricalEarthquake as HistEQ,
)
from app.services.earthquake_parametric_service import EarthquakeParametricService


class TestFindEarthquakesInBox:
    """Tests for EarthquakeParametricService.find_earthquakes_in_box."""

    def test_earthquake_inside_box(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        box = EarthquakeBoundingBox(
            id="b1", name="Box", north=40, south=30, east=-80, west=-100
        )
        eq = HistEQ(
            event_id="us1",
            magnitude=6.0,
            place="Test",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=35.0,
            longitude=-90.0,
            depth_km=10.0,
        )
        result = svc.find_earthquakes_in_box([eq], box)
        assert len(result) == 1

    def test_earthquake_outside_box(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        box = EarthquakeBoundingBox(
            id="b1", name="Box", north=40, south=30, east=-80, west=-100
        )
        eq = HistEQ(
            event_id="us1",
            magnitude=6.0,
            place="Test",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=50.0,
            longitude=-90.0,
            depth_km=10.0,
        )
        result = svc.find_earthquakes_in_box([eq], box)
        assert len(result) == 0


class TestEQFilterByTriggerCriteria:
    """Tests for EarthquakeParametricService.filter_by_trigger_criteria."""

    def test_none_trigger_passes_all(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        eq = HistEQ(
            event_id="us1",
            magnitude=3.0,
            place="Test",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=35.0,
            longitude=-90.0,
            depth_km=10.0,
        )
        result = svc.filter_by_trigger_criteria([eq], trigger=None)
        assert len(result) == 1

    def test_trigger_filters_correctly(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        trigger = EarthquakeTriggerCriteria(min_magnitude=5.0)
        eq_pass = HistEQ(
            event_id="us1",
            magnitude=6.0,
            place="Test",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=35.0,
            longitude=-90.0,
            depth_km=10.0,
        )
        eq_fail = HistEQ(
            event_id="us2",
            magnitude=4.0,
            place="Test",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=35.0,
            longitude=-90.0,
            depth_km=10.0,
        )
        result = svc.filter_by_trigger_criteria([eq_pass, eq_fail], trigger)
        assert len(result) == 1
        assert result[0].event_id == "us1"


class TestCalculateBoxStatistics:
    """Tests for EarthquakeParametricService.calculate_box_statistics."""

    def test_empty_earthquakes(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        box = EarthquakeBoundingBox(
            id="b1", name="Box", north=40, south=30, east=-80, west=-100
        )
        stats = svc.calculate_box_statistics([], box, 1980, 2024)
        assert stats.total_earthquakes == 0
        assert stats.trigger_probability == 0.0
        assert stats.average_magnitude == 0.0

    def test_with_earthquakes(self) -> None:
        svc = EarthquakeParametricService.__new__(EarthquakeParametricService)
        box = EarthquakeBoundingBox(
            id="b1", name="Box", north=40, south=30, east=-80, west=-100
        )
        earthquakes = [
            HistEQ(
                event_id=f"us{i}",
                magnitude=5.0 + i,
                place="Test",
                event_time=datetime(2020, i + 1, 1, tzinfo=timezone.utc),
                latitude=35.0,
                longitude=-90.0,
                depth_km=10.0 + i * 20,
            )
            for i in range(3)
        ]
        stats = svc.calculate_box_statistics(earthquakes, box, 2010, 2024)
        assert stats.total_earthquakes == 3
        assert stats.years_analyzed == 15
        assert stats.annual_frequency > 0
        assert stats.average_magnitude > 0
        assert stats.trigger_probability > 0


# ---------------------------------------------------------------------------
# EarthquakeService (mocked DB)
# ---------------------------------------------------------------------------

class TestEarthquakeService:
    """Tests for EarthquakeService with mocked database."""

    @patch("app.services.earthquake_service.db")
    def test_get_by_id_found(self, mock_db) -> None:
        from app.services.earthquake_service import EarthquakeService

        mock_eq = MagicMock()
        mock_eq.id = 1
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_eq

        svc = EarthquakeService()
        result = svc.get_by_id(1)
        assert result is not None
        assert result.id == 1

    @patch("app.services.earthquake_service.db")
    def test_get_by_id_not_found(self, mock_db) -> None:
        from app.services.earthquake_service import EarthquakeService

        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None
        svc = EarthquakeService()
        result = svc.get_by_id(999)
        assert result is None

    @patch("app.services.earthquake_service.db")
    def test_get_by_usgs_id(self, mock_db) -> None:
        from app.services.earthquake_service import EarthquakeService

        mock_eq = MagicMock()
        mock_eq.usgs_id = "us12345"
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_eq

        svc = EarthquakeService()
        result = svc.get_by_usgs_id("us12345")
        assert result.usgs_id == "us12345"

    @patch("app.services.earthquake_service.db")
    def test_create(self, mock_db) -> None:
        from app.services.earthquake_service import EarthquakeService

        svc = EarthquakeService()
        data = {
            "usgs_id": "us999",
            "magnitude": 5.0,
            "magnitude_type": "mw",
            "depth_km": 10.0,
            "latitude": 34.0,
            "longitude": -118.0,
            "place": "LA",
            "event_time": datetime(2025, 1, 1, tzinfo=timezone.utc),
            "status": "automatic",
            "tsunami": 0,
            "significance": 100,
        }
        result = svc.create(data)
        mock_db.session.add.assert_called_once()
        mock_db.session.flush.assert_called_once()


# ---------------------------------------------------------------------------
# HurricaneService (mocked DB)
# ---------------------------------------------------------------------------

class TestHurricaneService:
    """Tests for HurricaneService with mocked database."""

    @patch("app.services.hurricane_service.db")
    def test_get_by_id_found(self, mock_db) -> None:
        from app.services.hurricane_service import HurricaneService

        mock_h = MagicMock()
        mock_h.id = 1
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_h

        svc = HurricaneService()
        result = svc.get_by_id(1)
        assert result is not None
        assert result.id == 1

    @patch("app.services.hurricane_service.db")
    def test_get_by_id_not_found(self, mock_db) -> None:
        from app.services.hurricane_service import HurricaneService

        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None
        svc = HurricaneService()
        assert svc.get_by_id(999) is None

    @patch("app.services.hurricane_service.db")
    def test_get_by_storm_id(self, mock_db) -> None:
        from app.services.hurricane_service import HurricaneService

        mock_h = MagicMock()
        mock_h.storm_id = "AL012025"
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_h

        svc = HurricaneService()
        result = svc.get_by_storm_id("AL012025")
        assert result.storm_id == "AL012025"


# ---------------------------------------------------------------------------
# SubscriptionService (mocked DB)
# ---------------------------------------------------------------------------

class TestSubscriptionService:
    """Tests for SubscriptionService with mocked database."""

    @patch("app.services.subscription_service.db")
    def test_create_subscription_new(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None

        svc = SubscriptionService()
        from app.schemas.subscription import SubscriptionCreate

        data = SubscriptionCreate(email="test@example.com")
        token, created = svc.create_subscription(data)
        assert created is True
        assert len(token) > 0

    @patch("app.services.subscription_service.db")
    def test_create_subscription_existing(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        existing = MagicMock()
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = existing

        svc = SubscriptionService()
        from app.schemas.subscription import SubscriptionCreate

        data = SubscriptionCreate(email="test@example.com")
        message, created = svc.create_subscription(data)
        assert created is False
        assert "registered" in message.lower()

    @patch("app.services.subscription_service.db")
    def test_verify_subscription_valid_token(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        mock_sub = MagicMock()
        mock_sub.is_verified = False
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_sub

        svc = SubscriptionService()
        message = svc.verify_subscription("valid-token")
        assert "registered" in message.lower()
        assert mock_sub.is_verified is True

    @patch("app.services.subscription_service.db")
    def test_verify_subscription_invalid_token(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        mock_db.session.execute.return_value.scalar_one_or_none.return_value = None

        svc = SubscriptionService()
        message = svc.verify_subscription("bad-token")
        assert "registered" in message.lower()

    @patch("app.services.subscription_service.db")
    def test_unsubscribe(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        mock_sub = MagicMock()
        mock_sub.is_active = True
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_sub

        svc = SubscriptionService()
        message = svc.unsubscribe("unsub-token")
        assert mock_sub.is_active is False

    @patch("app.services.subscription_service.db")
    def test_resubscribe(self, mock_db) -> None:
        from app.services.subscription_service import SubscriptionService

        mock_sub = MagicMock()
        mock_sub.is_active = False
        mock_db.session.execute.return_value.scalar_one_or_none.return_value = mock_sub

        svc = SubscriptionService()
        message = svc.resubscribe("unsub-token")
        assert mock_sub.is_active is True


# ---------------------------------------------------------------------------
# EmailService (mocked SMTP)
# ---------------------------------------------------------------------------

class TestEmailService:
    """Tests for EmailService with mocked SMTP."""

    @patch("app.services.email_service.EmailService._send_smtp")
    def test_send_email_success(self, mock_smtp) -> None:
        from app.services.email_service import EmailService

        mock_smtp.return_value = True
        svc = EmailService()
        assert svc.send_email("user@test.com", "Subject", "<p>Body</p>") is True

    @patch("app.services.email_service.EmailService._send_smtp")
    def test_send_email_failure(self, mock_smtp) -> None:
        from app.services.email_service import EmailService

        mock_smtp.return_value = False
        svc = EmailService()
        assert svc.send_email("user@test.com", "Subject", "<p>Body</p>") is False

    @patch("app.services.email_service.EmailService.send_email")
    def test_send_verification_email(self, mock_send, app) -> None:
        from app.services.email_service import EmailService

        mock_send.return_value = True
        svc = EmailService()
        with app.app_context():
            result = svc.send_verification_email(
                "user@test.com", "token123", base_url="http://localhost:5000"
            )
        assert result is True
        mock_send.assert_called_once()
        call_args = mock_send.call_args
        assert "token123" in call_args[0][2]  # html_body contains token

    @patch("app.services.email_service.EmailService.send_email")
    def test_send_alert_email(self, mock_send, app) -> None:
        from app.services.email_service import EmailService

        mock_send.return_value = True
        svc = EmailService()
        with app.app_context():
            result = svc.send_alert_email(
                to_email="user@test.com",
                event_type="earthquake",
                event_data={"magnitude": 7.0, "place": "Alaska"},
                unsubscribe_token="unsub123",
                base_url="http://localhost:5000",
            )
        assert result is True


# ---------------------------------------------------------------------------
# USGSClient (mocked httpx)
# ---------------------------------------------------------------------------

class TestUSGSClient:
    """Tests for USGSClient with mocked HTTP responses."""

    @patch("app.services.usgs_client.httpx.Client")
    def test_fetch_earthquakes(self, MockClient) -> None:
        from app.services.usgs_client import USGSClient

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "features": [{"id": "us1", "properties": {"mag": 5.0}}]
        }
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = USGSClient()
        result = client.fetch_earthquakes(
            start_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
            end_time=datetime(2025, 1, 2, tzinfo=timezone.utc),
        )
        assert len(result) == 1

    @patch("app.services.usgs_client.httpx.Client")
    def test_fetch_earthquake_by_id_found(self, MockClient) -> None:
        from app.services.usgs_client import USGSClient

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "features": [{"id": "us123", "properties": {"mag": 6.0}}]
        }
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = USGSClient()
        result = client.fetch_earthquake_by_id("us123")
        assert result is not None
        assert result["id"] == "us123"

    @patch("app.services.usgs_client.httpx.Client")
    def test_fetch_earthquake_by_id_not_found(self, MockClient) -> None:
        from app.services.usgs_client import USGSClient

        mock_response = MagicMock()
        mock_response.json.return_value = {"features": []}
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = USGSClient()
        result = client.fetch_earthquake_by_id("nonexistent")
        assert result is None

    @patch("app.services.usgs_client.httpx.Client")
    def test_parse_feature(self, MockClient) -> None:
        from app.services.usgs_client import USGSClient

        client = USGSClient()
        feature = {
            "id": "us123",
            "properties": {
                "mag": 5.5,
                "magType": "mw",
                "place": "Alaska",
                "time": 1704067200000,
                "updated": 1704067200000,
                "status": "reviewed",
                "tsunami": 0,
                "sig": 500,
                "url": "https://usgs.gov/us123",
            },
            "geometry": {"coordinates": [-150.0, 61.0, 10.0]},
        }
        result = client.parse_feature(feature)
        assert result["usgs_id"] == "us123"
        assert result["magnitude"] == 5.5
        assert result["latitude"] == 61.0
        assert result["longitude"] == -150.0
        assert result["depth_km"] == 10.0


# ---------------------------------------------------------------------------
# NOAAClient (mocked httpx)
# ---------------------------------------------------------------------------

class TestNOAAClient:
    """Tests for NOAAClient with mocked HTTP responses."""

    @patch("app.services.noaa_client.httpx.Client")
    def test_fetch_active_storms(self, MockClient) -> None:
        from app.services.noaa_client import NOAAClient

        mock_response = MagicMock()
        mock_response.json.return_value = {
            "activeStorms": [
                {
                    "id": "al052025",
                    "name": "Edouard",
                    "classification": "HU",
                    "basin": "AL",
                    "lat": 25.0,
                    "lon": -90.0,
                    "intensity": 100,
                    "movementDir": "NW",
                    "movementSpeed": 12,
                    "pressure": 960,
                    "headline": "Hurricane Edouard",
                }
            ]
        }
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = NOAAClient()
        storms = client.fetch_active_storms()
        assert len(storms) == 1
        assert storms[0]["name"] == "Edouard"

    @patch("app.services.noaa_client.httpx.Client")
    def test_parse_storm(self, MockClient) -> None:
        from app.services.noaa_client import NOAAClient

        client = NOAAClient()
        result = client.parse_storm({
            "id": "al01",
            "name": "Ana",
            "classification": "TS",
            "basin": "AL",
            "lat": 20.0,
            "lon": -80.0,
            "intensity": 60,
        })
        assert result is not None
        assert result["name"] == "Ana"

    @patch("app.services.noaa_client.httpx.Client")
    def test_parse_storm_bad_data(self, MockClient) -> None:
        from app.services.noaa_client import NOAAClient

        client = NOAAClient()
        result = client.parse_storm({"lat": "not-a-number"})
        # Should return None on ValueError
        assert result is None


# ---------------------------------------------------------------------------
# NWSClient (mocked httpx)
# ---------------------------------------------------------------------------

class TestNWSClient:
    """Tests for NWSClient with mocked HTTP responses."""

    @patch("app.services.nws_client.httpx.Client")
    def test_fetch_active_alerts_empty(self, MockClient) -> None:
        from app.services.nws_client import NWSClient

        mock_response = MagicMock()
        mock_response.json.return_value = {"features": []}
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = NWSClient()
        alerts = client.fetch_active_alerts()
        assert alerts == []

    @patch("app.services.nws_client.httpx.Client")
    def test_fetch_tornado_warnings_delegates(self, MockClient) -> None:
        from app.services.nws_client import NWSClient

        mock_response = MagicMock()
        mock_response.json.return_value = {"features": []}
        mock_response.raise_for_status = MagicMock()
        MockClient.return_value.get.return_value = mock_response

        client = NWSClient()
        result = client.fetch_tornado_warnings()
        assert isinstance(result, list)
