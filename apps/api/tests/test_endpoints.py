"""Tests for API endpoints: health, earthquakes, hurricanes, middleware."""
from __future__ import annotations

from unittest.mock import AsyncMock, patch

import pytest
import pytest_asyncio
from httpx import AsyncClient


pytestmark = pytest.mark.asyncio


# ── Root & health ─────────────────────────────────────────────────────────


async def test_root_health_check(client: AsyncClient) -> None:
    """GET / returns 200 with status, service, and version."""
    resp = await client.get("/")
    assert resp.status_code == 200
    body = resp.json()
    assert body["status"] == "healthy"
    assert body["service"] == "Catastrophe Mapping API"
    assert "version" in body


async def test_api_health_check(client: AsyncClient) -> None:
    """GET /api/v1/health returns 200."""
    resp = await client.get("/api/v1/health")
    assert resp.status_code == 200
    body = resp.json()
    assert "status" in body


async def test_api_health_redirect(client: AsyncClient) -> None:
    """GET /api/health redirects (307) to /api/v1/health."""
    resp = await client.get("/api/health", follow_redirects=False)
    assert resp.status_code == 307
    assert "/api/v1/health" in resp.headers["location"]


# ── Earthquake endpoints ─────────────────────────────────────────────────


async def test_recent_earthquakes(client: AsyncClient) -> None:
    """GET /api/v1/earthquakes/recent returns a GeoJSON FeatureCollection."""
    mock_data: list = [
        {
            "type": "Feature",
            "properties": {"mag": 5.2, "place": "Test Location"},
            "geometry": {"type": "Point", "coordinates": [-120.0, 35.0, 10.0]},
        }
    ]
    mock_client = AsyncMock()
    mock_client.fetch_earthquakes = AsyncMock(return_value=mock_data)

    with patch("app.routers.earthquakes.get_usgs_client", return_value=mock_client):
        resp = await client.get("/api/v1/earthquakes/recent")

    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert isinstance(body["features"], list)
    assert body["metadata"]["count"] == 1


async def test_significant_earthquakes(client: AsyncClient) -> None:
    """GET /api/v1/earthquakes/significant returns a FeatureCollection."""
    mock_client = AsyncMock()
    mock_client.fetch_earthquakes = AsyncMock(return_value=[])

    with patch("app.routers.earthquakes.get_usgs_client", return_value=mock_client):
        resp = await client.get("/api/v1/earthquakes/significant")

    assert resp.status_code == 200
    body = resp.json()
    assert body["type"] == "FeatureCollection"
    assert body["features"] == []


# ── Hurricane endpoints ──────────────────────────────────────────────────


async def test_active_hurricanes(client: AsyncClient) -> None:
    """GET /api/v1/hurricanes/active returns envelope with data."""
    mock_client = AsyncMock()
    mock_client.fetch_active_storms = AsyncMock(return_value=[])

    with patch("app.routers.hurricanes.get_noaa_client", return_value=mock_client):
        resp = await client.get("/api/v1/hurricanes/active")

    assert resp.status_code == 200
    body = resp.json()
    assert "data" in body


# ── Middleware / headers ─────────────────────────────────────────────────


async def test_security_headers_present(client: AsyncClient) -> None:
    """Responses must include key security headers."""
    resp = await client.get("/")
    assert resp.headers.get("X-Content-Type-Options") == "nosniff"
    assert resp.headers.get("X-Frame-Options") == "DENY"
    assert resp.headers.get("X-XSS-Protection") == "1; mode=block"
    assert "Referrer-Policy" in resp.headers


async def test_correlation_id_header(client: AsyncClient) -> None:
    """Every response must carry an X-Correlation-ID header."""
    resp = await client.get("/")
    assert "X-Correlation-ID" in resp.headers
    # UUID4 format: 8-4-4-4-12 hex chars
    assert len(resp.headers["X-Correlation-ID"]) == 36


async def test_cors_headers(client: AsyncClient) -> None:
    """An OPTIONS preflight must return CORS allow headers."""
    resp = await client.options(
        "/",
        headers={
            "Origin": "http://localhost:5173",
            "Access-Control-Request-Method": "GET",
        },
    )
    # FastAPI/Starlette CORS middleware should respond
    assert "access-control-allow-origin" in resp.headers


# ── Error handling ────────────────────────────────────────────────────────


async def test_404_returns_json(client: AsyncClient) -> None:
    """Non-existent route returns JSON instead of plain text."""
    resp = await client.get("/api/v1/nonexistent-route-xyz")
    assert resp.status_code in (404, 405)
    # FastAPI default 404 is JSON
    body = resp.json()
    assert "detail" in body or "errors" in body
