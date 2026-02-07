"""Real-time notifications via WebSocket."""
from __future__ import annotations

import json
import logging
from collections import defaultdict
from datetime import datetime, timezone
from typing import Any, Dict, List, Set
from urllib.parse import urlparse

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.config import settings

router = APIRouter()
logger = logging.getLogger(__name__)

# Maximum WebSocket connections per IP address
_MAX_CONNECTIONS_PER_IP: int = 5


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    _ALL_EVENT_TYPES = frozenset(
        ["earthquake", "hurricane", "wildfire", "tornado", "flooding", "hail"]
    )
    _ALLOWED_ACTIONS = frozenset(["subscribe", "unsubscribe", "ping"])

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, List[str]] = {}
        self.connections_per_ip: Dict[str, int] = defaultdict(int)
        self.connection_ip_map: Dict[WebSocket, str] = {}

    @property
    def total_connections(self) -> int:
        """Return the number of active connections."""
        return len(self.active_connections)

    def _get_client_ip(self, websocket: WebSocket) -> str:
        """Extract the client IP from the WebSocket connection."""
        client = websocket.client
        return client.host if client else "unknown"

    def can_accept(self, websocket: WebSocket) -> tuple[bool, str]:
        """Check whether a new connection can be accepted.

        Returns a (allowed, reason) tuple.
        """
        # Global connection cap
        if self.total_connections >= settings.MAX_WS_CONNECTIONS:
            return False, "Maximum server connections reached"

        # Per-IP cap
        ip = self._get_client_ip(websocket)
        if self.connections_per_ip.get(ip, 0) >= _MAX_CONNECTIONS_PER_IP:
            return False, "Too many connections from this IP"

        return True, ""

    @staticmethod
    def validate_origin(websocket: WebSocket) -> bool:
        """Validate that the WebSocket Origin header is among allowed origins.

        If no CORS origins are configured we allow all (development mode).
        """
        if not settings.CORS_ORIGINS:
            return True

        origin = websocket.headers.get("origin")
        if origin is None:
            # Non-browser clients may not send Origin — allow them
            return True

        parsed = urlparse(origin)
        origin_base = f"{parsed.scheme}://{parsed.netloc}"
        return origin_base in settings.CORS_ORIGINS

    async def connect(self, websocket: WebSocket) -> None:
        """Accept the WebSocket and register the connection."""
        await websocket.accept()
        ip = self._get_client_ip(websocket)
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = list(self._ALL_EVENT_TYPES)
        self.connections_per_ip[ip] += 1
        self.connection_ip_map[websocket] = ip

    def disconnect(self, websocket: WebSocket) -> None:
        """Remove the connection and clean up tracking data."""
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)
        ip = self.connection_ip_map.pop(websocket, None)
        if ip and self.connections_per_ip.get(ip, 0) > 0:
            self.connections_per_ip[ip] -= 1
            if self.connections_per_ip[ip] <= 0:
                del self.connections_per_ip[ip]

    async def send_personal_message(self, message: dict, websocket: WebSocket) -> None:
        try:
            await websocket.send_json(message)
        except Exception:
            logger.debug("Failed to send personal message, removing connection")
            self.disconnect(websocket)

    async def broadcast(self, message: Any, event_type: str | None = None) -> None:
        """Broadcast message to all connected clients (optionally filtered by subscription)."""
        disconnected: List[WebSocket] = []
        for connection in self.active_connections:
            if event_type and event_type not in self.subscriptions.get(connection, []):
                continue
            try:
                if isinstance(message, str):
                    await connection.send_text(message)
                else:
                    await connection.send_json(message)
            except Exception:
                disconnected.append(connection)
        # Clean up broken connections
        for conn in disconnected:
            self.disconnect(conn)

    def subscribe(self, websocket: WebSocket, event_types: List[str]) -> List[str]:
        """Update subscription preferences for a client.

        Only allows known event types; unknown types are silently dropped.
        Returns the list of accepted event types.
        """
        valid = [et for et in event_types if et in self._ALL_EVENT_TYPES]
        self.subscriptions[websocket] = valid
        return valid


manager = ConnectionManager()


@router.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time catastrophe notifications.

    Client can send:
    - {"action": "subscribe", "events": ["earthquake", "hurricane"]}
    - {"action": "unsubscribe", "events": ["hurricane"]}

    Server sends:
    - {"type": "earthquake", "data": {...}}
    - {"type": "hurricane", "data": {...}}
    - {"type": "pong", "timestamp": "..."}
    """
    # --- Pre-accept validation ------------------------------------------------
    if not manager.validate_origin(websocket):
        await websocket.close(code=4003, reason="Origin not allowed")
        return

    allowed, reason = manager.can_accept(websocket)
    if not allowed:
        await websocket.close(code=4004, reason=reason)
        return

    # --- Accept & run ---------------------------------------------------------
    await manager.connect(websocket)

    # Send welcome message
    await manager.send_personal_message(
        {
            "type": "connected",
            "message": "Connected to Catastrophe Mapping real-time feed",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        websocket,
    )

    try:
        while True:
            data = await websocket.receive_text()

            try:
                message = json.loads(data)
                action = message.get("action")

                # Validate action type
                if action not in manager._ALLOWED_ACTIONS:
                    await manager.send_personal_message(
                        {"type": "error", "message": f"Unknown action: {action}"},
                        websocket,
                    )
                    continue

                if action == "subscribe":
                    events = message.get("events", [])
                    accepted = manager.subscribe(websocket, events)
                    await manager.send_personal_message(
                        {"type": "subscribed", "events": accepted}, websocket
                    )

                elif action == "unsubscribe":
                    events = message.get("events", [])
                    current = set(manager.subscriptions.get(websocket, []))
                    remaining = list(current - set(events))
                    manager.subscriptions[websocket] = remaining
                    await manager.send_personal_message(
                        {"type": "unsubscribed", "events": remaining}, websocket
                    )

                elif action == "ping":
                    await manager.send_personal_message(
                        {
                            "type": "pong",
                            "timestamp": datetime.now(timezone.utc).isoformat(),
                        },
                        websocket,
                    )

            except json.JSONDecodeError:
                await manager.send_personal_message(
                    {"type": "error", "message": "Invalid JSON"}, websocket
                )

    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def notify_earthquake(earthquake_data: dict) -> None:
    """
    Send earthquake notification to all subscribed clients.
    Called by the earthquake ingestion service when new event is detected.
    """
    await manager.broadcast(
        {
            "type": "earthquake",
            "data": earthquake_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        event_type="earthquake",
    )


async def notify_hurricane(hurricane_data: dict) -> None:
    """
    Send hurricane notification to all subscribed clients.
    Called by the hurricane ingestion service when update is detected.
    """
    await manager.broadcast(
        {
            "type": "hurricane",
            "data": hurricane_data,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        },
        event_type="hurricane",
    )
