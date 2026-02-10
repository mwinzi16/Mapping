"""Wildfire API blueprint — active fire data from NASA FIRMS."""
from __future__ import annotations

import logging
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request

from app.core.clients import get_firms_client
from app.core.response import error_response, success_response

logger = logging.getLogger(__name__)

bp = Blueprint("wildfires", __name__)


@bp.route("/active", methods=["GET"])
def get_active_wildfires() -> tuple:
    """Get currently active wildfires from NASA FIRMS.

    Query params:
        region (str): Region filter — "USA" or "Global" (default "USA").
        hours (int): Lookback window in hours (1–168, default 24).

    Returns:
        GeoJSON FeatureCollection of active fire detections.
    """
    region: str = request.args.get("region", "USA")
    hours: int = request.args.get("hours", 24, type=int)

    if not (1 <= hours <= 168):
        return jsonify(error_response("VALIDATION_ERROR", "hours must be between 1 and 168")), 400

    client = get_firms_client()

    try:
        if region.upper() == "USA":
            fires = client.fetch_active_fires_usa(days=max(1, hours // 24))
        else:
            fires = client.fetch_global_fires(hours=hours)
    except Exception:
        logger.exception("Failed to fetch active wildfires from NASA FIRMS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "NASA FIRMS service temporarily unavailable")), 502

    # Convert to GeoJSON
    features: list[dict] = [
        {
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [fire["longitude"], fire["latitude"]],
            },
            "properties": {
                "source_id": fire.get("source_id"),
                "brightness": fire.get("brightness"),
                "frp": fire.get("frp"),
                "confidence": fire.get("confidence"),
                "satellite": fire.get("satellite"),
                "detected_at": (
                    fire["detected_at"].isoformat()
                    if fire.get("detected_at")
                    else None
                ),
            },
        }
        for fire in fires
    ]

    return jsonify({
        "type": "FeatureCollection",
        "features": features,
        "metadata": {
            "generated": datetime.now(timezone.utc).isoformat(),
            "count": len(features),
            "source": "NASA FIRMS",
            "region": region,
        },
    }), 200


@bp.route("/major", methods=["GET"])
def get_major_wildfires() -> tuple:
    """Get major/named wildfires with containment info.

    Returns:
        JSON list of major wildfires (placeholder — requires NIFC integration).
    """
    return jsonify(success_response(
        [],
        meta={
            "count": 0,
            "source": "NIFC/InciWeb",
            "note": "Major wildfire tracking requires NIFC data integration",
        },
    )), 200
