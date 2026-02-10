"""Indemnity insurance API blueprint — historical event data for TIV analysis."""
from __future__ import annotations

import logging
from datetime import datetime
from typing import Optional

from flask import Blueprint, jsonify, request

from app.core.auth import require_api_key
from app.core.response import error_response, success_response
from app.extensions import limiter
from app.schemas.earthquake_parametric import EarthquakeDatasetType
from app.schemas.indemnity import HistoricalEarthquake, HistoricalHurricane
from app.schemas.parametric import DatasetType
from app.services.earthquake_parametric_service import (
    EarthquakeParametricService,
)
from app.services.indemnity_service import (
    calculate_earthquake_significance,
    calculate_hurricane_significance,
)
from app.services.parametric_service import ParametricService

logger = logging.getLogger(__name__)

bp = Blueprint("indemnity", __name__)

# Module-level singletons
_eq_parametric_service = EarthquakeParametricService()
_parametric_service = ParametricService()


@bp.route("/historical/earthquakes", methods=["GET"])
@limiter.limit("30/minute")
@require_api_key
def get_historical_earthquakes() -> tuple:
    """Get historical earthquakes for indemnity impact analysis.

    Supports two modes:

    - **significant**: Returns top *N* earthquakes sorted by a composite
      significance score derived from magnitude, depth, and USGS metrics.
    - **all**: Returns every earthquake matching the filter criteria.

    Query params:
        mode (str): "significant" or "all" (default "significant").
        limit (int): Number of events for significant mode (1–100, default 30).
        start_year (int): First year (1900–2030, default 1980).
        end_year (int): Last year (1900–2030, default 2025).
        min_magnitude (float): Minimum magnitude (4.0–10.0, default 6.0).

    Returns:
        JSON list of ``HistoricalEarthquake`` dicts sorted by significance.
    """
    mode: str = request.args.get("mode", "significant")
    limit: int = request.args.get("limit", 30, type=int)
    start_year: int = request.args.get("start_year", 1980, type=int)
    end_year: int = request.args.get("end_year", 2025, type=int)
    min_magnitude: float = request.args.get("min_magnitude", 6.0, type=float)

    # Validate
    if mode not in ("all", "significant"):
        return jsonify(error_response("VALIDATION_ERROR", "mode must be 'all' or 'significant'")), 400
    if not (1 <= limit <= 100):
        return jsonify(error_response("VALIDATION_ERROR", "limit must be between 1 and 100")), 400
    if not (1900 <= start_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "start_year must be between 1900 and 2030")), 400
    if not (1900 <= end_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "end_year must be between 1900 and 2030")), 400
    if not (4.0 <= min_magnitude <= 10.0):
        return jsonify(error_response("VALIDATION_ERROR", "min_magnitude must be between 4.0 and 10.0")), 400

    try:
        earthquakes = _eq_parametric_service.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=EarthquakeDatasetType.USGS_WORLDWIDE,
        )

        # Transform and calculate significance
        result: list[dict] = []
        for eq in earthquakes:
            # Build a dict the significance scorer expects
            eq_dict: dict = {
                "magnitude": float(
                    getattr(eq, "magnitude", 0)
                    if hasattr(eq, "magnitude")
                    else eq.get("magnitude", 0)  # type: ignore[union-attr]
                ),
                "depth_km": float(
                    getattr(eq, "depth_km", 0)
                    if hasattr(eq, "depth_km")
                    else eq.get("depth_km", 0)  # type: ignore[union-attr]
                ),
                "significance": int(
                    getattr(eq, "significance", 0)
                    if hasattr(eq, "significance")
                    else eq.get("significance", 0)  # type: ignore[union-attr]
                ),
            }
            significance = calculate_earthquake_significance(eq_dict)

            # Extract fields — handles both Pydantic models and dicts
            if hasattr(eq, "place"):
                name = str(getattr(eq, "place", "Unknown Location"))
                lat = float(getattr(eq, "latitude", 0))
                lon = float(getattr(eq, "longitude", 0))
                event_id = str(getattr(eq, "event_id", ""))
                depth_km = getattr(eq, "depth_km", None)
                event_time = getattr(eq, "event_time", "")
            else:
                name = str(eq.get("place") or eq.get("name") or "Unknown Location")  # type: ignore[union-attr]
                lat = float(eq.get("latitude", 0))  # type: ignore[union-attr]
                lon = float(eq.get("longitude", 0))  # type: ignore[union-attr]
                event_id = str(
                    eq.get("event_id") or eq.get("id") or eq.get("usgs_id") or ""  # type: ignore[union-attr]
                )
                depth_km = eq.get("depth_km")  # type: ignore[union-attr]
                event_time = (
                    eq.get("event_time")  # type: ignore[union-attr]
                    or eq.get("time")  # type: ignore[union-attr]
                    or eq.get("date")  # type: ignore[union-attr]
                    or ""
                )

            # Normalise event_time to ISO string
            date_val: str
            if isinstance(event_time, datetime):
                date_val = event_time.isoformat()
            elif isinstance(event_time, (int, float)):
                date_val = datetime.fromtimestamp(
                    event_time / 1000
                ).isoformat()
            else:
                date_val = str(event_time)

            result.append(
                HistoricalEarthquake(
                    id=event_id,
                    name=name,
                    magnitude=eq_dict["magnitude"],
                    lat=lat,
                    lon=lon,
                    date=date_val,
                    depth_km=depth_km,
                    deaths=getattr(eq, "deaths", None)
                    if hasattr(eq, "deaths")
                    else eq.get("deaths") if isinstance(eq, dict) else None,  # type: ignore[union-attr]
                    damage_usd=getattr(eq, "damage_usd", None)
                    if hasattr(eq, "damage_usd")
                    else eq.get("damage_usd") if isinstance(eq, dict) else None,  # type: ignore[union-attr]
                    significance_score=significance,
                ).model_dump()
            )

        # Sort by significance descending
        result.sort(key=lambda x: x["significance_score"], reverse=True)

        # Apply limit for significant mode
        if mode == "significant":
            result = result[:limit]

        return jsonify(success_response(result)), 200

    except Exception:
        logger.exception("Failed to fetch historical earthquakes for indemnity")
        return jsonify(error_response(
            "INTERNAL_ERROR",
            "Failed to fetch earthquakes",
        )), 500


@bp.route("/historical/hurricanes", methods=["GET"])
@limiter.limit("30/minute")
@require_api_key
def get_historical_hurricanes() -> tuple:
    """Get historical hurricanes with full track data for indemnity analysis.

    Supports two modes:

    - **significant**: Returns top *N* hurricanes sorted by a composite
      significance score derived from category, wind speed, and pressure.
    - **all**: Returns every hurricane matching the filter criteria.

    Query params:
        mode (str): "significant" or "all" (default "significant").
        limit (int): Number of events for significant mode (1–100, default 30).
        start_year (int): First year (1850–2030, default 1980).
        end_year (int): Last year (1850–2030, default 2025).
        min_category (int): Minimum Saffir-Simpson category (0–5, default 1).
        basin (str): Optional basin filter (NA, EP, WP, etc.).

    Returns:
        JSON list of ``HistoricalHurricane`` dicts sorted by significance.
    """
    mode: str = request.args.get("mode", "significant")
    limit: int = request.args.get("limit", 30, type=int)
    start_year: int = request.args.get("start_year", 1980, type=int)
    end_year: int = request.args.get("end_year", 2025, type=int)
    min_category: int = request.args.get("min_category", 1, type=int)
    basin: Optional[str] = request.args.get("basin")

    # Validate
    if mode not in ("all", "significant"):
        return jsonify(error_response("VALIDATION_ERROR", "mode must be 'all' or 'significant'")), 400
    if not (1 <= limit <= 100):
        return jsonify(error_response("VALIDATION_ERROR", "limit must be between 1 and 100")), 400
    if not (1850 <= start_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "start_year must be between 1850 and 2030")), 400
    if not (1850 <= end_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "end_year must be between 1850 and 2030")), 400
    if not (0 <= min_category <= 5):
        return jsonify(error_response("VALIDATION_ERROR", "min_category must be between 0 and 5")), 400

    try:
        hurricanes = _parametric_service.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=DatasetType.IBTRACS,
        )

        # Transform and calculate significance
        result: list[dict] = []
        for h in hurricanes:
            # Build a dict the significance scorer expects
            if hasattr(h, "max_category"):
                h_dict: dict = {
                    "max_category": getattr(h, "max_category", 0),
                    "max_wind_mph": (
                        getattr(h, "max_wind_knots", 0) * 1.15078
                        if getattr(h, "max_wind_knots", None)
                        else getattr(h, "max_wind_mph", 0)
                    ),
                    "min_pressure_mb": getattr(h, "min_pressure_mb", None),
                }
            else:
                h_dict = {
                    "max_category": h.get("max_category", 0),  # type: ignore[union-attr]
                    "max_wind_mph": (
                        h.get("max_wind_knots", 0) * 1.15078  # type: ignore[union-attr]
                        if h.get("max_wind_knots")  # type: ignore[union-attr]
                        else h.get("max_wind_mph", 0)  # type: ignore[union-attr]
                    ),
                    "min_pressure_mb": h.get("min_pressure"),  # type: ignore[union-attr]
                }

            significance = calculate_hurricane_significance(h_dict)

            # Convert track data to a consistent list-of-dicts format
            raw_track = (
                getattr(h, "track", [])
                if hasattr(h, "track")
                else h.get("track", [])  # type: ignore[union-attr]
            )
            track: list[dict] = []
            for point in raw_track:
                if hasattr(point, "latitude"):
                    track.append({
                        "lat": getattr(point, "latitude", 0),
                        "lon": getattr(point, "longitude", 0),
                        "time": str(getattr(point, "timestamp", "")),
                        "wind_mph": getattr(point, "wind_knots", 0) * 1.15078
                        if getattr(point, "wind_knots", None)
                        else 0,
                        "pressure_mb": getattr(point, "pressure_mb", None),
                        "category": getattr(point, "category", None),
                        "status": getattr(point, "status", "unknown"),
                    })
                else:
                    track.append({
                        "lat": point.get("lat", point.get("latitude", 0)),
                        "lon": point.get("lon", point.get("longitude", 0)),
                        "time": point.get(
                            "time", point.get("iso_time", "")
                        ),
                        "wind_mph": point.get(
                            "wind_mph", point.get("usa_wind", 0)
                        ),
                        "pressure_mb": point.get(
                            "pressure_mb", point.get("usa_pres")
                        ),
                        "category": point.get("category"),
                        "status": point.get(
                            "status", point.get("nature", "unknown")
                        ),
                    })

            # Extract metadata — handles both Pydantic models and dicts
            if hasattr(h, "storm_id"):
                storm_id = str(getattr(h, "storm_id", ""))
                storm_name = str(getattr(h, "name", "Unnamed"))
                season = int(getattr(h, "year", 0))
                max_cat = int(getattr(h, "max_category", 0))
                min_pressure = getattr(h, "min_pressure_mb", None)
                damage_usd = getattr(h, "damage_usd", None)
                deaths = getattr(h, "deaths", None)
            else:
                storm_id = str(h.get("storm_id", h.get("id", "")))  # type: ignore[union-attr]
                storm_name = str(h.get("name", "Unnamed"))  # type: ignore[union-attr]
                season = int(h.get("year", h.get("season", 0)))  # type: ignore[union-attr]
                max_cat = int(h.get("max_category", 0))  # type: ignore[union-attr]
                min_pressure = h.get("min_pressure")  # type: ignore[union-attr]
                damage_usd = h.get("damage_usd")  # type: ignore[union-attr]
                deaths = h.get("deaths")  # type: ignore[union-attr]

            result.append(
                HistoricalHurricane(
                    id=storm_id,
                    name=storm_name,
                    season=season,
                    max_category=max_cat,
                    max_wind_mph=h_dict["max_wind_mph"],
                    min_pressure_mb=min_pressure,
                    damage_usd=damage_usd,
                    deaths=deaths,
                    significance_score=significance,
                    track=track,
                ).model_dump()
            )

        # Sort by significance descending
        result.sort(key=lambda x: x["significance_score"], reverse=True)

        # Apply limit for significant mode
        if mode == "significant":
            result = result[:limit]

        return jsonify(success_response(result)), 200

    except Exception:
        logger.exception("Failed to fetch historical hurricanes for indemnity")
        return jsonify(error_response(
            "INTERNAL_ERROR",
            "Failed to fetch hurricanes",
        )), 500


@bp.route("/historical/summary", methods=["GET"])
@limiter.limit("30/minute")
def get_historical_summary() -> tuple:
    """Get summary of available historical data for the UI.

    Returns:
        JSON object with dataset metadata for earthquakes and hurricanes.
    """
    return jsonify(success_response({
        "earthquakes": {
            "datasets": ["USGS Worldwide"],
            "year_range": {"min": 1900, "max": 2025},
            "magnitude_range": {"min": 4.0, "max": 10.0},
            "default_mode": "significant",
            "default_limit": 30,
        },
        "hurricanes": {
            "datasets": ["IBTrACS"],
            "year_range": {"min": 1850, "max": 2025},
            "basins": ["NA", "EP", "WP", "NI", "SI", "SP", "SA"],
            "category_range": {"min": 0, "max": 5},
            "default_mode": "significant",
            "default_limit": 30,
        },
    })), 200
