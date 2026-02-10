"""Parametric insurance analysis API blueprint — hurricane trigger-box analysis."""
from __future__ import annotations

import logging
from typing import Optional

from flask import Blueprint, jsonify, request

from app.core.auth import require_api_key
from app.core.response import error_response, success_response
from app.extensions import limiter
from app.schemas.parametric import (
    AnalysisRequest,
    BulkAnalysisRequest,
    DatasetType,
    YearRange,
)
from app.services.ibtracs_client import IBTrACSClient
from app.services.parametric_service import ParametricService

logger = logging.getLogger(__name__)

bp = Blueprint("parametric", __name__)

# Module-level singletons
_parametric_service = ParametricService()
_ibtracs_client = IBTrACSClient()


def _get_parametric_service() -> ParametricService:
    """Return the singleton ParametricService instance."""
    return _parametric_service


def _get_ibtracs_client() -> IBTrACSClient:
    """Return the singleton IBTrACSClient instance."""
    return _ibtracs_client


@bp.route("/datasets", methods=["GET"])
def get_available_datasets() -> tuple:
    """Get list of available hurricane datasets.

    Returns metadata including name, description, basins, and year range.

    Returns:
        JSON list of dataset information.
    """
    service = _get_parametric_service()
    return jsonify(success_response(service.get_available_datasets())), 200


@bp.route("/hurricanes/historical", methods=["GET"])
def get_historical_hurricanes() -> tuple:
    """Fetch historical hurricane data with optional filters.

    Query params:
        start_year (int): First year (1850–2030, default 1980).
        end_year (int): Last year (1850–2030, default 2024).
        min_category (int): Minimum Saffir-Simpson category (0–5, default 0).
        basin (str): Ocean basin code filter.
        dataset (str): Dataset identifier (default "ibtracs").

    Returns:
        JSON list of hurricanes with complete track data.
    """
    start_year: int = request.args.get("start_year", 1980, type=int)
    end_year: int = request.args.get("end_year", 2024, type=int)
    min_category: int = request.args.get("min_category", 0, type=int)
    basin: Optional[str] = request.args.get("basin")
    dataset_str: str = request.args.get("dataset", DatasetType.IBTRACS.value)

    # Validate
    if not (1850 <= start_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "start_year must be between 1850 and 2030")), 400
    if not (1850 <= end_year <= 2030):
        return jsonify(error_response("VALIDATION_ERROR", "end_year must be between 1850 and 2030")), 400
    if not (0 <= min_category <= 5):
        return jsonify(error_response("VALIDATION_ERROR", "min_category must be between 0 and 5")), 400

    try:
        dataset = DatasetType(dataset_str)
    except ValueError:
        return jsonify(error_response("VALIDATION_ERROR", f"Invalid dataset: {dataset_str}")), 400

    service = _get_parametric_service()
    try:
        hurricanes = service.get_historical_hurricanes(
            start_year=start_year,
            end_year=end_year,
            min_category=min_category,
            basin=basin,
            dataset=dataset,
        )
        return jsonify(success_response(hurricanes)), 200
    except Exception:
        logger.exception("Failed to fetch historical hurricanes")
        return jsonify(error_response(
            "EXTERNAL_SERVICE_ERROR",
            "Data source temporarily unavailable",
        )), 502


@bp.route("/analysis/intersections", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def get_box_intersections() -> tuple:
    """Get all hurricanes that intersect with a bounding box.

    Returns the intersecting hurricanes with entry/exit points.
    Respects trigger criteria if defined on the box.

    Request body (JSON):
        See ``AnalysisRequest`` schema.

    Returns:
        JSON list of intersection results.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        analysis = AnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_parametric_service()
    try:
        hurricanes = service.get_historical_hurricanes(
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_category=analysis.min_category,
            basin=analysis.basin,
            dataset=analysis.dataset,
        )

        intersections = service.find_box_intersections(
            hurricanes, analysis.box
        )

        # Filter by trigger criteria if defined
        if analysis.box.trigger:
            intersections = service.filter_by_trigger_criteria(
                intersections, analysis.box.trigger
            )

        # Build simplified results without full track data
        result: list[dict] = []
        for intersection in intersections:
            hurricane = intersection["hurricane"]
            result.append({
                "storm_id": hurricane["storm_id"],
                "name": hurricane["name"],
                "year": hurricane["year"],
                "basin": hurricane["basin"],
                "max_category": hurricane["max_category"],
                "max_wind_knots": hurricane["max_wind_knots"],
                "entry_point": intersection["entry_point"],
                "exit_point": intersection["exit_point"],
                "max_intensity_in_box": intersection["max_intensity_in_box"],
                "min_pressure_in_box": intersection.get(
                    "min_pressure_in_box"
                ),
                "category_at_crossing": intersection[
                    "category_at_crossing"
                ],
            })

        return jsonify(success_response(result)), 200
    except Exception:
        logger.exception("Failed to compute box intersections")
        return jsonify(error_response("INTERNAL_ERROR", "Analysis failed")), 500


@bp.route("/analysis/statistics", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def calculate_box_statistics() -> tuple:
    """Calculate statistical analysis for a trigger box.

    Returns trigger probability, frequency, category distribution, etc.

    Request body (JSON):
        See ``AnalysisRequest`` schema.

    Returns:
        JSON box statistics.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        analysis = AnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_parametric_service()
    try:
        stats = service.analyze_box(
            box=analysis.box,
            start_year=analysis.start_year,
            end_year=analysis.end_year,
            min_category=analysis.min_category,
            basin=analysis.basin,
            dataset=analysis.dataset,
        )
        return jsonify(success_response(stats)), 200
    except Exception:
        logger.exception("Failed to calculate box statistics")
        return jsonify(error_response("INTERNAL_ERROR", "Statistics calculation failed")), 500


@bp.route("/analysis/bulk-statistics", methods=["POST"])
@limiter.limit("30/minute")
@require_api_key
def calculate_bulk_statistics() -> tuple:
    """Calculate statistics for multiple boxes at once.

    More efficient than calling individual statistics endpoints.

    Request body (JSON):
        See ``BulkAnalysisRequest`` schema.

    Returns:
        JSON dict of box-id → statistics.
    """
    body = request.get_json(silent=True)
    if not body:
        return jsonify(error_response("VALIDATION_ERROR", "Request body is required")), 400

    try:
        bulk = BulkAnalysisRequest(**body)
    except Exception as exc:
        return jsonify(error_response("VALIDATION_ERROR", str(exc))), 400

    service = _get_parametric_service()
    try:
        stats = service.analyze_multiple_boxes(
            boxes=bulk.boxes,
            start_year=bulk.start_year,
            end_year=bulk.end_year,
            min_category=bulk.min_category,
            basin=bulk.basin,
            dataset=bulk.dataset,
        )
        return jsonify(success_response(stats)), 200
    except Exception:
        logger.exception("Failed to calculate bulk statistics")
        return jsonify(error_response("INTERNAL_ERROR", "Bulk statistics calculation failed")), 500


@bp.route("/basins", methods=["GET"])
def get_available_basins() -> tuple:
    """Get list of available ocean basins for a dataset.

    Query params:
        dataset (str): Dataset identifier (default "ibtracs").

    Returns:
        JSON list of basin codes.
    """
    dataset_str: str = request.args.get("dataset", DatasetType.IBTRACS.value)

    try:
        dataset = DatasetType(dataset_str)
    except ValueError:
        return jsonify(error_response("VALIDATION_ERROR", f"Invalid dataset: {dataset_str}")), 400

    if dataset == DatasetType.HURDAT2_ATLANTIC:
        return jsonify(success_response(["atlantic"])), 200
    if dataset == DatasetType.HURDAT2_PACIFIC:
        return jsonify(success_response(["pacific"])), 200

    client = _get_ibtracs_client()
    return jsonify(success_response(client.get_available_basins())), 200


@bp.route("/year-range", methods=["GET"])
def get_year_range() -> tuple:
    """Get the available year range for historical data.

    Query params:
        basin (str): Optional basin filter.
        dataset (str): Dataset identifier (default "ibtracs").

    Returns:
        JSON object with min_year and max_year.
    """
    basin: Optional[str] = request.args.get("basin")
    dataset_str: str = request.args.get("dataset", DatasetType.IBTRACS.value)

    try:
        dataset = DatasetType(dataset_str)
    except ValueError:
        return jsonify(error_response("VALIDATION_ERROR", f"Invalid dataset: {dataset_str}")), 400

    if dataset == DatasetType.HURDAT2_ATLANTIC:
        return jsonify(success_response(
            YearRange(min_year=1851, max_year=2023).model_dump()
        )), 200
    if dataset == DatasetType.HURDAT2_PACIFIC:
        return jsonify(success_response(
            YearRange(min_year=1949, max_year=2023).model_dump()
        )), 200

    client = _get_ibtracs_client()
    try:
        min_year, max_year = client.get_year_range(basin)
    except Exception:
        logger.exception("Failed to get year range from IBTrACS")
        return jsonify(error_response("EXTERNAL_SERVICE_ERROR", "IBTrACS service temporarily unavailable")), 502

    return jsonify(success_response(
        YearRange(min_year=min_year, max_year=max_year).model_dump()
    )), 200
