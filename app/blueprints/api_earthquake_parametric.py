"""Earthquake parametric insurance analysis API blueprint."""
from __future__ import annotations

import logging

from flask import Blueprint, jsonify, request

from app.core.auth import require_api_key
from app.core.response import error_response, success_response
from app.extensions import limiter
from app.schemas.earthquake_parametric import (
    EarthquakeAnalysisRequest,
    EarthquakeBulkAnalysisRequest,
    EarthquakeDatasetType,
)
from app.services.earthquake_parametric_service import (
    EarthquakeParametricService,
)

logger = logging.getLogger(__name__)

bp = Blueprint("earthquake_parametric", __name__)

# Module-level singleton
_eq_parametric_service = EarthquakeParametricService()


def _get_earthquake_parametric_service() -> EarthquakeParametricService:
    """Return the singleton EarthquakeParametricService instance."""
    return _eq_parametric_service


@bp.route("/datasets", methods=["GET"])
def get_available_datasets() -> tuple:
    """Get list of available earthquake datasets.

    Returns dataset metadata including name, description, coverage,
    and year range.

    Returns:
        JSON dict of dataset information.
    """
    service = _get_earthquake_parametric_service()
    return jsonify(success_response(service.get_available_datasets())), 200


@bp.route("/earthquakes/historical", methods=["GET"])
def get_historical_earthquakes() -> tuple:
    """Fetch historical earthquake data with optional filters.

    Query params:
        start_year (int): First year (1900–2030, default 1980).
        end_year (int): Last year (1900–2030, default 2024).
        min_magnitude (float): Lower magnitude bound (0–10, default 4.0).
        dataset (str): Dataset identifier (default "usgs_worldwide").

    Returns:
        JSON list of historical earthquakes.
    """
    start_year: int = request.args.get("start_year", 1980, type=int)
    end_year: int = request.args.get("end_year", 2024, type=int)
    min_magnitude: float = request.args.get("min_magnitude", 4.0, type=float)
    dataset_str: str = request.args.get(
        "dataset", EarthquakeDatasetType.USGS_WORLDWIDE.value
    )

    # Validate
    if not (1900 <= start_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "start_year must be between 1900 and 2030")), 400
    if not (1900 <= end_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "end_year must be between 1900 and 2030")), 400
    if not (0 <= min_magnitude <= 10):
        return jsonify(error_response("VALIDATION_ERROR", "min_magnitude must be between 0 and 10")), 400

    try:
        dataset = EarthquakeDatasetType(dataset_str)
    except ValueError:
        return jsonify(error_response("VALIDATION_ERROR", f"Invalid dataset: {dataset_str}")), 400

    service = _get_earthquake_parametric_service()
    try:
        earthquakes = service.get_historical_earthquakes(
            start_year=start_year,
            end_year=end_year,
            min_magnitude=min_magnitude,
            dataset=dataset,
        )
        return jsonify(success_response(earthquakes)), 200
    except Exception:
        logger.exception("Failed to fetch historical earthquakes")
        return jsonify(error_response(
            "EXTERNAL_SERVICE_ERROR",
            "Data source temporarily unavailable",
        )), 502


@bp.route("/analysis/earthquakes", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def get_earthquakes_in_box() -> tuple:
    """Get all earthquakes that fall within a bounding box.

    Returns the earthquakes with their details.  Respects trigger
    criteria if defined on the box.

    Request body (JSON):
        See ``EarthquakeAnalysisRequest`` schema.

    Returns:
        JSON list of earthquakes in the box.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        analysis = EarthquakeAnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_earthquake_parametric_service()
    try:
        earthquakes = service.get_historical_earthquakes(
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_magnitude=analysis.min_magnitude,
            dataset=analysis.dataset,
        )

        box_earthquakes = service.find_earthquakes_in_box(
            earthquakes, analysis.box
        )

        # Filter by trigger criteria if defined
        if analysis.box.trigger:
            box_earthquakes = service.filter_by_trigger_criteria(
                box_earthquakes, analysis.box.trigger
            )

        return jsonify(success_response(box_earthquakes)), 200
    except Exception:
        logger.exception("Failed to analyze earthquakes in box")
        return jsonify(error_response("INTERNAL_ERROR", "Analysis failed")), 500


@bp.route("/analysis/statistics", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def calculate_box_statistics() -> tuple:
    """Calculate comprehensive statistics for earthquakes in a trigger box.

    Returns magnitude distribution, depth distribution, annual frequency,
    and trigger probability based on Poisson distribution.

    Request body (JSON):
        See ``EarthquakeAnalysisRequest`` schema.

    Returns:
        JSON earthquake box statistics.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        analysis = EarthquakeAnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_earthquake_parametric_service()
    try:
        stats = service.calculate_statistics(
            box=analysis.box,
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_magnitude=analysis.min_magnitude,
            dataset=analysis.dataset,
        )
        return jsonify(success_response(stats)), 200
    except Exception:
        logger.exception("Failed to calculate earthquake box statistics")
        return jsonify(error_response("INTERNAL_ERROR", "Statistics calculation failed")), 500


@bp.route("/analysis/bulk-statistics", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def calculate_bulk_statistics() -> tuple:
    """Calculate statistics for multiple earthquake trigger boxes.

    More efficient than calculating one at a time as earthquake data
    is fetched once and reused.

    Request body (JSON):
        See ``EarthquakeBulkAnalysisRequest`` schema.

    Returns:
        JSON dict of box-id → statistics.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        bulk = EarthquakeBulkAnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_earthquake_parametric_service()
    try:
        stats = service.calculate_all_statistics(
            boxes=bulk.boxes,
            start_year=bulk.start_year,
            end_year=bulk.end_year,
            min_magnitude=bulk.min_magnitude,
            dataset=bulk.dataset,
        )
        return jsonify(success_response(stats)), 200
    except Exception:
        logger.exception("Failed to calculate bulk earthquake statistics")
        return jsonify(error_response("INTERNAL_ERROR", "Bulk statistics calculation failed")), 500
