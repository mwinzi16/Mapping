"""Severe Weather API blueprint — tornado, hail, and flood alerts."""
from __future__ import annotations

import logging
from typing import Optional

from flask import Blueprint, jsonify, request

from app.core.clients import get_nws_client
from app.core.response import error_response, success_response
from app.utils.geojson import (
    alerts_to_feature_collection,
    storm_reports_to_feature_collection,
)

logger = logging.getLogger(__name__)

bp = Blueprint("severe_weather", __name__)


@bp.route("/alerts", methods=["GET"])
def get_severe_weather_alerts() -> tuple:
    """Get active severe weather alerts from NOAA NWS.

    Query params:
        event_type (str): Category — tornado, hail, flooding, thunderstorm.
        state (str): Two-letter state code (e.g. TX, CA, FL).
        severity (str): Extreme, Severe, Moderate, or Minor.

    Returns:
        JSON-wrapped GeoJSON FeatureCollection of matching alerts.
    """
    event_type: Optional[str] = request.args.get("event_type")
    state: Optional[str] = request.args.get("state")
    severity: Optional[str] = request.args.get("severity")

    client = get_nws_client()

    event_types: Optional[list[str]] = None
    if event_type:
        type_mapping: dict[str, list[str]] = {
            "tornado": ["Tornado"],
            "hail": ["Hail", "Severe Thunderstorm"],
            "flooding": ["Flood", "Flash Flood"],
            "thunderstorm": ["Severe Thunderstorm", "Thunderstorm"],
        }
        event_types = type_mapping.get(event_type.lower())

    try:
        alerts = client.fetch_active_alerts(
            event_types=event_types,
            area=state,
            severity=severity,
        )
    except Exception:
        logger.exception("Failed to fetch severe weather alerts from NWS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NWS service temporarily unavailable")), 502

    return jsonify(success_response(alerts_to_feature_collection(
        alerts,
        extra_metadata={"filter": {"event_type": event_type, "state": state}},
    ))), 200


@bp.route("/tornadoes", methods=["GET"])
def get_tornado_alerts() -> tuple:
    """Get active tornado warnings and watches.

    Returns:
        JSON-wrapped GeoJSON FeatureCollection of tornado alerts.
    """
    client = get_nws_client()

    try:
        alerts = client.fetch_tornado_warnings()
    except Exception:
        logger.exception("Failed to fetch tornado alerts from NWS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NWS service temporarily unavailable")), 502

    return jsonify(success_response(alerts_to_feature_collection(alerts))), 200


@bp.route("/flooding", methods=["GET"])
def get_flood_alerts() -> tuple:
    """Get active flood warnings and watches.

    Returns:
        JSON-wrapped GeoJSON FeatureCollection of flood alerts.
    """
    client = get_nws_client()

    try:
        alerts = client.fetch_flood_alerts()
    except Exception:
        logger.exception("Failed to fetch flood alerts from NWS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NWS service temporarily unavailable")), 502

    return jsonify(success_response(alerts_to_feature_collection(alerts))), 200


@bp.route("/hail", methods=["GET"])
def get_hail_reports() -> tuple:
    """Get severe thunderstorm alerts (which include hail threats).

    Returns:
        JSON-wrapped GeoJSON FeatureCollection of hail/thunderstorm alerts.
    """
    client = get_nws_client()

    try:
        alerts = client.fetch_severe_thunderstorm_alerts()
    except Exception:
        logger.exception("Failed to fetch hail/thunderstorm alerts from NWS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NWS service temporarily unavailable")), 502

    return jsonify(success_response(alerts_to_feature_collection(alerts))), 200


@bp.route("/storm-reports", methods=["GET"])
def get_storm_reports() -> tuple:
    """Get today's storm reports from Storm Prediction Center.

    Includes confirmed tornadoes, hail, and damaging winds.

    Returns:
        JSON-wrapped GeoJSON FeatureCollection of storm reports.
    """
    client = get_nws_client()

    try:
        reports = client.fetch_spc_storm_reports()
    except Exception:
        logger.exception("Failed to fetch SPC storm reports")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "SPC service temporarily unavailable")), 502

    return jsonify(success_response(
        storm_reports_to_feature_collection(reports)
    )), 200
