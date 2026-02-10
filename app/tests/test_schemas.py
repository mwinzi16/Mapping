"""Tests for Pydantic schema validation."""
from __future__ import annotations

from datetime import datetime, timezone

import pytest
from pydantic import ValidationError

# ---------------------------------------------------------------------------
# Earthquake schemas
# ---------------------------------------------------------------------------
from app.schemas.earthquake import (
    EarthquakeBase,
    EarthquakeCreate,
    EarthquakeFilter,
    EarthquakeList,
    EarthquakeResponse,
)


class TestEarthquakeBase:
    """Tests for EarthquakeBase schema."""

    def test_valid_earthquake_base(self) -> None:
        eq = EarthquakeBase(
            magnitude=5.5,
            magnitude_type="mw",
            depth_km=10.0,
            latitude=34.05,
            longitude=-118.25,
            place="10km N of Los Angeles, CA",
        )
        assert eq.magnitude == 5.5
        assert eq.place == "10km N of Los Angeles, CA"

    def test_magnitude_out_of_range_high(self) -> None:
        with pytest.raises(ValidationError):
            EarthquakeBase(
                magnitude=11.0,
                magnitude_type="mw",
                depth_km=10.0,
                latitude=0.0,
                longitude=0.0,
                place="test",
            )

    def test_magnitude_out_of_range_low(self) -> None:
        with pytest.raises(ValidationError):
            EarthquakeBase(
                magnitude=-1.0,
                magnitude_type="mw",
                depth_km=10.0,
                latitude=0.0,
                longitude=0.0,
                place="test",
            )

    def test_latitude_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            EarthquakeBase(
                magnitude=5.0,
                magnitude_type="mw",
                depth_km=10.0,
                latitude=91.0,
                longitude=0.0,
                place="test",
            )

    def test_longitude_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            EarthquakeBase(
                magnitude=5.0,
                magnitude_type="mw",
                depth_km=10.0,
                latitude=0.0,
                longitude=181.0,
                place="test",
            )

    def test_missing_required_field(self) -> None:
        with pytest.raises(ValidationError):
            EarthquakeBase(magnitude=5.0, magnitude_type="mw")  # type: ignore[call-arg]


class TestEarthquakeCreate:
    """Tests for EarthquakeCreate schema."""

    def test_valid_create(self) -> None:
        eq = EarthquakeCreate(
            magnitude=6.0,
            magnitude_type="mw",
            depth_km=15.0,
            latitude=35.0,
            longitude=-120.0,
            place="California",
            usgs_id="us1234",
            event_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
        )
        assert eq.usgs_id == "us1234"
        assert eq.status == "automatic"
        assert eq.tsunami == 0
        assert eq.significance == 0


class TestEarthquakeResponse:
    """Tests for EarthquakeResponse schema."""

    def test_from_orm_with_geometry(self) -> None:
        mock_eq = type(
            "MockEarthquake",
            (),
            {
                "id": 1,
                "usgs_id": "us123",
                "magnitude": 5.0,
                "magnitude_type": "mw",
                "depth_km": 10.0,
                "latitude": 34.0,
                "longitude": -118.0,
                "place": "LA",
                "event_time": datetime(2025, 1, 1, tzinfo=timezone.utc),
                "status": "reviewed",
                "tsunami": 0,
                "significance": 500,
                "created_at": datetime(2025, 1, 1, tzinfo=timezone.utc),
            },
        )()
        resp = EarthquakeResponse.from_orm_with_geometry(mock_eq)
        assert resp.geometry["type"] == "Point"
        assert resp.geometry["coordinates"] == [-118.0, 34.0]
        assert resp.id == 1


class TestEarthquakeList:
    """Tests for EarthquakeList schema pagination."""

    def test_pages_property(self) -> None:
        lst = EarthquakeList(items=[], total=55, page=1, per_page=10)
        assert lst.pages == 6

    def test_pages_single(self) -> None:
        lst = EarthquakeList(items=[], total=5, page=1, per_page=10)
        assert lst.pages == 1


class TestEarthquakeFilter:
    """Tests for EarthquakeFilter schema."""

    def test_all_optional(self) -> None:
        f = EarthquakeFilter()
        assert f.min_magnitude is None
        assert f.start_date is None


# ---------------------------------------------------------------------------
# Hurricane schemas
# ---------------------------------------------------------------------------
from app.schemas.hurricane import HurricaneCreate, HurricaneFilter, HurricaneResponse


class TestHurricaneCreate:
    """Tests for HurricaneCreate schema."""

    def test_valid_hurricane(self) -> None:
        h = HurricaneCreate(
            name="Katrina",
            basin="AL",
            classification="Hurricane",
            category=5,
            latitude=25.0,
            longitude=-90.0,
            max_wind_mph=175,
            max_wind_knots=152,
            storm_id="AL122005",
            advisory_time=datetime(2005, 8, 28, tzinfo=timezone.utc),
        )
        assert h.name == "Katrina"
        assert h.category == 5

    def test_category_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            HurricaneCreate(
                name="X",
                basin="AL",
                classification="Hurricane",
                category=6,
                latitude=25.0,
                longitude=-90.0,
                max_wind_mph=100,
                max_wind_knots=87,
                storm_id="XX",
                advisory_time=datetime(2025, 1, 1, tzinfo=timezone.utc),
            )


class TestHurricaneResponse:
    """Tests for HurricaneResponse schema."""

    def test_from_orm_with_geometry(self) -> None:
        mock_h = type(
            "MockHurricane",
            (),
            {
                "id": 1,
                "storm_id": "AL012025",
                "name": "Andrea",
                "basin": "AL",
                "classification": "Tropical Storm",
                "category": 1,
                "latitude": 25.0,
                "longitude": -80.0,
                "max_wind_mph": 75,
                "max_wind_knots": 65,
                "min_pressure_mb": 990,
                "movement_direction": "NW",
                "movement_speed_mph": 12,
                "advisory_time": datetime(2025, 6, 1, tzinfo=timezone.utc),
                "is_active": True,
                "created_at": datetime(2025, 6, 1, tzinfo=timezone.utc),
                "updated_at": datetime(2025, 6, 1, tzinfo=timezone.utc),
            },
        )()
        resp = HurricaneResponse.from_orm_with_geometry(mock_h)
        assert resp.geometry["coordinates"] == [-80.0, 25.0]


# ---------------------------------------------------------------------------
# Subscription schemas
# ---------------------------------------------------------------------------
from app.schemas.subscription import (
    LocationFilter,
    SubscriptionCreate,
    SubscriptionMessage,
    SubscriptionUpdate,
)


class TestSubscriptionCreate:
    """Tests for SubscriptionCreate schema."""

    def test_valid_subscription(self) -> None:
        sub = SubscriptionCreate(email="user@example.com")
        assert sub.alert_earthquakes is True
        assert sub.min_earthquake_magnitude == 5.0
        assert sub.max_emails_per_day == 10

    def test_invalid_email(self) -> None:
        with pytest.raises(ValidationError):
            SubscriptionCreate(email="not-an-email")

    def test_with_location_filter(self) -> None:
        sub = SubscriptionCreate(
            email="user@example.com",
            location_filter=LocationFilter(
                latitude=40.0, longitude=-74.0, radius_km=100
            ),
        )
        assert sub.location_filter is not None
        assert sub.location_filter.radius_km == 100

    def test_magnitude_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            SubscriptionCreate(
                email="user@example.com",
                min_earthquake_magnitude=11.0,
            )


class TestLocationFilter:
    """Tests for LocationFilter schema."""

    def test_valid_location(self) -> None:
        loc = LocationFilter(latitude=40.0, longitude=-74.0, radius_km=500)
        assert loc.radius_km == 500

    def test_default_radius(self) -> None:
        loc = LocationFilter(latitude=0, longitude=0)
        assert loc.radius_km == 500

    def test_radius_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            LocationFilter(latitude=0, longitude=0, radius_km=6000)


class TestSubscriptionMessage:
    """Tests for SubscriptionMessage schema."""

    def test_message(self) -> None:
        msg = SubscriptionMessage(message="Hello")
        assert msg.message == "Hello"
        assert msg.success is True


class TestSubscriptionUpdate:
    """Tests for SubscriptionUpdate schema."""

    def test_partial_update(self) -> None:
        upd = SubscriptionUpdate(alert_earthquakes=False)
        assert upd.alert_earthquakes is False
        assert upd.alert_hurricanes is None

    def test_all_none(self) -> None:
        upd = SubscriptionUpdate()
        dump = upd.model_dump(exclude_unset=True)
        assert dump == {}


# ---------------------------------------------------------------------------
# Parametric schemas
# ---------------------------------------------------------------------------
from app.schemas.parametric import (
    AnalysisRequest,
    BoundingBox,
    BoxStatistics,
    DatasetType,
    TriggerCriteria,
)


class TestBoundingBox:
    """Tests for BoundingBox schema."""

    def test_valid_box(self) -> None:
        box = BoundingBox(
            id="box1", name="Gulf of Mexico", north=30.0, south=20.0, east=-80.0, west=-100.0
        )
        assert box.id == "box1"
        assert box.trigger is None


class TestTriggerCriteria:
    """Tests for TriggerCriteria schema."""

    def test_matches_all(self) -> None:
        tc = TriggerCriteria(min_category=3, min_wind_knots=100)
        assert tc.matches(category=4, wind_knots=120, pressure_mb=950) is True

    def test_matches_fail_category(self) -> None:
        tc = TriggerCriteria(min_category=3)
        assert tc.matches(category=2, wind_knots=80, pressure_mb=None) is False

    def test_matches_fail_wind(self) -> None:
        tc = TriggerCriteria(min_wind_knots=100)
        assert tc.matches(category=3, wind_knots=90, pressure_mb=None) is False

    def test_matches_pressure(self) -> None:
        tc = TriggerCriteria(max_pressure_mb=960)
        assert tc.matches(category=3, wind_knots=100, pressure_mb=950) is True

    def test_matches_pressure_too_high(self) -> None:
        tc = TriggerCriteria(max_pressure_mb=960)
        assert tc.matches(category=3, wind_knots=100, pressure_mb=970) is False

    def test_matches_pressure_none(self) -> None:
        tc = TriggerCriteria(max_pressure_mb=960)
        assert tc.matches(category=3, wind_knots=100, pressure_mb=None) is False

    def test_matches_no_criteria(self) -> None:
        tc = TriggerCriteria()
        assert tc.matches(category=0, wind_knots=30, pressure_mb=None) is True


class TestDatasetType:
    """Tests for DatasetType enum."""

    def test_ibtracs_value(self) -> None:
        assert DatasetType.IBTRACS.value == "ibtracs"

    def test_hurdat2_atlantic_value(self) -> None:
        assert DatasetType.HURDAT2_ATLANTIC.value == "hurdat2_atlantic"


# ---------------------------------------------------------------------------
# Earthquake parametric schemas
# ---------------------------------------------------------------------------
from app.schemas.earthquake_parametric import (
    EarthquakeBoundingBox,
    EarthquakeDatasetType,
    EarthquakeTriggerCriteria,
    HistoricalEarthquake as HistEQ,
)


class TestEarthquakeTriggerCriteria:
    """Tests for EarthquakeTriggerCriteria schema."""

    def test_matches_magnitude(self) -> None:
        tc = EarthquakeTriggerCriteria(min_magnitude=5.0)
        assert tc.matches(magnitude=6.0, depth_km=10.0) is True
        assert tc.matches(magnitude=4.0, depth_km=10.0) is False

    def test_matches_depth(self) -> None:
        tc = EarthquakeTriggerCriteria(max_depth_km=50.0)
        assert tc.matches(magnitude=5.0, depth_km=30.0) is True
        assert tc.matches(magnitude=5.0, depth_km=60.0) is False

    def test_matches_min_depth(self) -> None:
        tc = EarthquakeTriggerCriteria(min_depth_km=10.0)
        assert tc.matches(magnitude=5.0, depth_km=5.0) is False
        assert tc.matches(magnitude=5.0, depth_km=15.0) is True

    def test_matches_no_criteria(self) -> None:
        tc = EarthquakeTriggerCriteria()
        assert tc.matches(magnitude=1.0, depth_km=1.0) is True


class TestHistoricalEarthquakeSchema:
    """Tests for HistoricalEarthquake (earthquake_parametric) schema."""

    def test_valid_historical_earthquake(self) -> None:
        eq = HistEQ(
            event_id="us123",
            magnitude=7.0,
            place="Alaska",
            event_time=datetime(2020, 1, 1, tzinfo=timezone.utc),
            latitude=61.0,
            longitude=-150.0,
            depth_km=10.0,
        )
        assert eq.magnitude == 7.0
        assert eq.tsunami == 0


# ---------------------------------------------------------------------------
# Indemnity schemas
# ---------------------------------------------------------------------------
from app.schemas.indemnity import (
    HistoricalEarthquake as IndemnityEQ,
    HistoricalHurricane as IndemnityHurricane,
)


class TestIndemnitySchemas:
    """Tests for indemnity historical event schemas."""

    def test_historical_earthquake(self) -> None:
        eq = IndemnityEQ(
            id="us123",
            name="Alaska Earthquake",
            magnitude=7.0,
            lat=61.0,
            lon=-150.0,
            date="2020-01-01",
            significance_score=80.5,
        )
        assert eq.significance_score == 80.5
        assert eq.deaths is None

    def test_historical_hurricane(self) -> None:
        h = IndemnityHurricane(
            id="AL122005",
            name="Katrina",
            season=2005,
            max_category=5,
            max_wind_mph=175.0,
            significance_score=95.0,
            track=[{"lat": 25.0, "lon": -90.0}],
        )
        assert h.max_category == 5
        assert len(h.track) == 1


# ---------------------------------------------------------------------------
# Severe weather schema
# ---------------------------------------------------------------------------
from app.schemas.severe_weather import SevereWeatherCreate


class TestSevereWeatherCreate:
    """Tests for SevereWeatherCreate schema."""

    def test_valid_tornado_event(self) -> None:
        sw = SevereWeatherCreate(
            event_type="tornado",
            latitude=35.0,
            longitude=-95.0,
            source_id="NWS-001",
            source="NWS",
            event_time=datetime(2025, 5, 1, tzinfo=timezone.utc),
            tornado_scale=3,
        )
        assert sw.event_type == "tornado"
        assert sw.tornado_scale == 3

    def test_invalid_event_type(self) -> None:
        with pytest.raises(ValidationError):
            SevereWeatherCreate(
                event_type="blizzard",
                latitude=35.0,
                longitude=-95.0,
                source_id="NWS-001",
                source="NWS",
                event_time=datetime(2025, 5, 1, tzinfo=timezone.utc),
            )


# ---------------------------------------------------------------------------
# Wildfire schema
# ---------------------------------------------------------------------------
from app.schemas.wildfire import WildfireCreate, WildfireResponse


class TestWildfireCreate:
    """Tests for WildfireCreate schema."""

    def test_valid_wildfire(self) -> None:
        wf = WildfireCreate(
            latitude=34.0,
            longitude=-118.0,
            source_id="FIRMS_001",
            source="NASA FIRMS",
            detected_at=datetime(2025, 7, 1, tzinfo=timezone.utc),
            confidence=85,
        )
        assert wf.confidence == 85

    def test_confidence_out_of_range(self) -> None:
        with pytest.raises(ValidationError):
            WildfireCreate(
                latitude=34.0,
                longitude=-118.0,
                source_id="FIRMS_001",
                source="NASA FIRMS",
                detected_at=datetime(2025, 7, 1, tzinfo=timezone.utc),
                confidence=101,
            )
