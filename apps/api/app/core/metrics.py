"""Prometheus metrics for monitoring."""
from __future__ import annotations

from prometheus_client import (
    CONTENT_TYPE_LATEST,
    Counter,
    Gauge,
    Histogram,
    generate_latest,
)
from starlette.requests import Request
from starlette.responses import Response

# Define metrics
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


async def metrics_endpoint(request: Request) -> Response:
    """Expose Prometheus metrics."""
    return Response(
        content=generate_latest(),
        media_type=CONTENT_TYPE_LATEST,
    )
