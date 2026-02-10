"""Earthquake API blueprint — list, filter, and fetch earthquake data."""
from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from flask import Blueprint, abort, jsonify, request

from app.core.auth import require_api_key
from app.core.response import error_response, paginated_response, success_response
from app.extensions import db
from app.services.earthquake_service import EarthquakeService
from app.core.clients import get_usgs_client

logger = logging.getLogger(__name__)

bp = Blueprint("earthquakes", __name__)


@bp.route("/", methods=["GET"])
def list_earthquakes() -> tuple:
    """Get a paginated list of earthquakes with optional filters.

    Query params:
        min_magnitude (float): Lower magnitude bound (0–10).
        max_magnitude (float): Upper magnitude bound (0–10).
        start_date (str): ISO-8601 start datetime filter.
        end_date (str): ISO-8601 end datetime filter.
        page (int): Page number (≥1, default 1).
        per_page (int): Items per page (1–100, default 50).

    Returns:
        JSON paginated earthquake list.
    """
    min_magnitude: Optional[float] = request.args.get(
        "min_magnitude", None, type=float
    )
    max_magnitude: Optional[float] = request.args.get(
        "max_magnitude", None, type=float
    )
    start_date_str: Optional[str] = request.args.get("start_date")
    end_date_str: Optional[str] = request.args.get("end_date")
    page: int = request.args.get("page", 1, type=int)
    per_page: int = request.args.get("per_page", 50, type=int)

    # Validate magnitude bounds
    if min_magnitude is not None and not (0 <= min_magnitude <= 10):
        return jsonify(error_response("VALIDATION_ERROR", "min_magnitude must be between 0 and 10")), 400
    if max_magnitude is not None and not (0 <= max_magnitude <= 10):
        return jsonify(error_response("VALIDATION_ERROR", "max_magnitude must be between 0 and 10")), 400

    # Validate pagination
    if page < 1:
        return jsonify(error_response("VALIDATION_ERROR", "page must be >= 1")), 400
    if not (1 <= per_page <= 100):
        return jsonify(error_response("VALIDATION_ERROR", "per_page must be between 1 and 100")), 400

    # Parse dates
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    try:
        if start_date_str:
            start_date = datetime.fromisoformat(start_date_str)
        if end_date_str:
            end_date = datetime.fromisoformat(end_date_str)
    except ValueError:
        return jsonify(error_response("VALIDATION_ERROR", "Invalid date format. Use ISO-8601.")), 400

    service = EarthquakeService()
    result = service.get_earthquakes(
        min_magnitude=min_magnitude,
        max_magnitude=max_magnitude,
        start_date=start_date,
        end_date=end_date,
        page=page,
        per_page=per_page,
    )
    return jsonify(success_response(result)), 200


@bp.route("/recent", methods=["GET"])
def get_recent_earthquakes() -> tuple:
    """Get recent earthquakes directly from USGS API.

    Query params:
        hours (int): Lookback window in hours (1–168, default 24).
        min_magnitude (float): Minimum magnitude (0–10, default 2.5).

    Returns:
        GeoJSON FeatureCollection of recent earthquakes.
    """
    hours: int = request.args.get("hours", 24, type=int)
    min_magnitude: float = request.args.get("min_magnitude", 2.5, type=float)

    if not (1 <= hours <= 168):
        return jsonify(error_response("VALIDATION_ERROR", "hours must be between 1 and 168")), 400
    if not (0 <= min_magnitude <= 10):
        return jsonify(error_response("VALIDATION_ERROR", "min_magnitude must be between 0 and 10")), 400

    client = get_usgs_client()
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(hours=hours)

    try:
        earthquakes = client.fetch_earthquakes(
            start_time=start_time,
            end_time=end_time,
            min_magnitude=min_magnitude,
        )
    except Exception:
        logger.exception("Failed to fetch recent earthquakes from USGS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "USGS service temporarily unavailable")), 502

    return jsonify({
        "type": "FeatureCollection",
        "features": earthquakes,
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(earthquakes),
            "parameters": {
                "hours": hours,
                "min_magnitude": min_magnitude,
            },
        },
    }), 200


@bp.route("/significant", methods=["GET"])
def get_significant_earthquakes() -> tuple:
    """Get significant earthquakes (M4.5+) from the past N days.

    Query params:
        days (int): Lookback window in days (1–365, default 30).

    Returns:
        GeoJSON FeatureCollection of significant earthquakes.
    """
    days: int = request.args.get("days", 30, type=int)

    if not (1 <= days <= 365):
        return jsonify(error_response("VALIDATION_ERROR", "days must be between 1 and 365")), 400

    client = get_usgs_client()
    end_time = datetime.now(timezone.utc)
    start_time = end_time - timedelta(days=days)

    try:
        earthquakes = client.fetch_earthquakes(
            start_time=start_time,
            end_time=end_time,
            min_magnitude=4.5,
        )
    except Exception:
        logger.exception("Failed to fetch significant earthquakes from USGS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "USGS service temporarily unavailable")), 502

    return jsonify({
        "type": "FeatureCollection",
        "features": earthquakes,
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(earthquakes),
        },
    }), 200


@bp.route("/<int:earthquake_id>", methods=["GET"])
def get_earthquake(earthquake_id: int) -> tuple:
    """Get a specific earthquake by database ID.

    Args:
        earthquake_id: Primary key of the earthquake record.

    Returns:
        JSON earthquake detail.
    """
    service = EarthquakeService()
    earthquake = service.get_by_id(earthquake_id)

    if not earthquake:
        abort(404, description="Earthquake not found")

    return jsonify(success_response(earthquake)), 200


@bp.route("/usgs/<string:usgs_id>", methods=["GET"])
def get_earthquake_by_usgs_id(usgs_id: str) -> tuple:
    """Get earthquake details directly from USGS by their event ID.

    Args:
        usgs_id: USGS event identifier string.

    Returns:
        JSON earthquake detail from USGS.
    """
    client = get_usgs_client()

    try:
        earthquake = client.fetch_earthquake_by_id(usgs_id)
    except Exception:
        logger.exception("Failed to fetch earthquake %s from USGS", usgs_id)
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "USGS service temporarily unavailable")), 502

    if not earthquake:
        abort(404, description="Earthquake not found")

    return jsonify(success_response(earthquake)), 200
