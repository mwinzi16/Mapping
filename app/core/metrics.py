"""Prometheus metrics for monitoring."""
from __future__ import annotations

from flask import Blueprint, Response
from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)

# ---------------------------------------------------------------------------
# Metric definitions
# ---------------------------------------------------------------------------

REQUEST_COUNT = Counter(
    "http_requests_total",
    "Total HTTP requests",
    ["method", "endpoint", "status_code"],
)
REQUEST_LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency",
    ["method", "endpoint"],
)
ACTIVE_CONNECTIONS = Gauge(
    "websocket_active_connections",
    "Number of active WebSocket connections",
)
EXTERNAL_API_CALLS = Counter(
    "external_api_calls_total",
    "Total external API calls",
    ["service", "status"],
)

# ---------------------------------------------------------------------------
# Metrics endpoint blueprint
# ---------------------------------------------------------------------------

metrics_bp = Blueprint("metrics", __name__)


@metrics_bp.route("/metrics")
def metrics_endpoint() -> Response:
    """Expose Prometheus metrics.

    Returns:
        Plain-text Prometheus metrics payload.
    """
    return Response(
        response=generate_latest(),
        status=200,
        content_type=CONTENT_TYPE_LATEST,
    )
