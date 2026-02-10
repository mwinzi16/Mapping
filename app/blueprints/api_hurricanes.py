"""Hurricane API blueprint — list, filter, and fetch hurricane data."""
from __future__ import annotations

import logging
from typing import Optional

from flask import Blueprint, abort, jsonify, request

from app.core.auth import require_api_key
from app.core.clients import get_noaa_client
from app.core.response import error_response, success_response
from app.extensions import db
from app.services.hurricane_service import HurricaneService

logger = logging.getLogger(__name__)

bp = Blueprint("hurricanes", __name__)


@bp.route("/", methods=["GET"])
def list_hurricanes() -> tuple:
    """Get a paginated list of hurricanes with optional filters.

    Query params:
        basin (str): Ocean basin code (AL, EP, WP).
        is_active (bool): Filter by active status.
        min_category (int): Minimum Saffir-Simpson category (1–5).
        page (int): Page number (≥1, default 1).
        per_page (int): Items per page (1–100, default 50).

    Returns:
        JSON paginated hurricane list.
    """
    basin: Optional[str] = request.args.get("basin")
    is_active_str: Optional[str] = request.args.get("is_active")
    min_category: Optional[int] = request.args.get(
        "min_category", None, type=int
    )
    page: int = request.args.get("page", 1, type=int)
    per_page: int = request.args.get("per_page", 50, type=int)

    # Parse boolean
    is_active: Optional[bool] = None
    if is_active_str is not None:
        is_active = is_active_str.lower() in ("true", "1", "yes")

    # Validate params
    if min_category is not None and not (1 <= min_category <= 5):
        return jsonify(error_response("VALIDATION_ERROR", "min_category must be between 1 and 5")), 400
    if page < 1:
        return jsonify(error_response("VALIDATION_ERROR", "page must be >= 1")), 400
    if not (1 <= per_page <= 100):
        return jsonify(error_response("VALIDATION_ERROR", "per_page must be between 1 and 100")), 400

    service = HurricaneService()
    result = service.get_hurricanes(
        basin=basin,
        is_active=is_active,
        min_category=min_category,
        page=page,
        per_page=per_page,
    )
    return jsonify(success_response(result)), 200


@bp.route("/active", methods=["GET"])
def get_active_storms() -> tuple:
    """Get currently active tropical storms and hurricanes from NOAA.

    Returns:
        JSON list of active storms with source metadata.
    """
    client = get_noaa_client()

    try:
        storms = client.fetch_active_storms()
    except Exception:
        logger.exception("Failed to fetch active storms from NOAA")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NOAA service temporarily unavailable")), 502

    return jsonify(success_response(
        storms,
        meta={"count": len(storms), "source": "NOAA National Hurricane Center"},
    )), 200


@bp.route("/season/<int:year>", methods=["GET"])
def get_season_hurricanes(year: int) -> tuple:
    """Get all hurricanes from a specific season.

    Args:
        year: The hurricane season year.

    Query params:
        basin (str): Ocean basin code (default "AL").

    Returns:
        JSON list of hurricanes for the season.
    """
    basin: str = request.args.get("basin", "AL")

    service = HurricaneService()
    hurricanes = service.get_by_season(year=year, basin=basin)

    return jsonify(success_response(
        hurricanes,
        meta={"year": year, "basin": basin, "count": len(hurricanes)},
    )), 200


@bp.route("/<int:hurricane_id>", methods=["GET"])
def get_hurricane(hurricane_id: int) -> tuple:
    """Get a specific hurricane by ID with full track history.

    Args:
        hurricane_id: Primary key of the hurricane record.

    Returns:
        JSON hurricane detail.
    """
    service = HurricaneService()
    hurricane = service.get_by_id(hurricane_id)

    if not hurricane:
        abort(404, description="Hurricane not found")

    return jsonify(success_response(hurricane)), 200


@bp.route("/<int:hurricane_id>/track", methods=["GET"])
def get_hurricane_track(hurricane_id: int) -> tuple:
    """Get the full track (path) of a hurricane as GeoJSON.

    Args:
        hurricane_id: Primary key of the hurricane record.

    Returns:
        GeoJSON Feature with the hurricane track geometry.
    """
    service = HurricaneService()
    track = service.get_track(hurricane_id)

    if not track:
        abort(404, description="Hurricane track not found")

    return jsonify({
        "type": "Feature",
        "geometry": track,
        "properties": {
            "hurricane_id": hurricane_id,
        },
    }), 200


@bp.route("/<int:hurricane_id>/forecast", methods=["GET"])
def get_hurricane_forecast(hurricane_id: int) -> tuple:
    """Get forecast cone and predicted path for an active hurricane.

    Args:
        hurricane_id: Primary key of the hurricane record.

    Returns:
        JSON forecast data from NOAA.
    """
    service = HurricaneService()
    hurricane = service.get_by_id(hurricane_id)

    if not hurricane:
        abort(404, description="Hurricane not found")

    if not hurricane.is_active:
        return jsonify(error_response(
            "INVALID_STATE",
            "Hurricane is no longer active",
        )), 400

    client = get_noaa_client()
    try:
        forecast = client.fetch_forecast(hurricane.storm_id)
    except Exception:
        logger.exception(
            "Failed to fetch forecast for hurricane %d", hurricane_id
        )
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NOAA forecast service temporarily unavailable")), 502

    return jsonify(success_response(forecast)), 200
