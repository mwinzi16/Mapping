"""
Real-time notifications via WebSocket.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any, Dict, List, Set

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()
logger = logging.getLogger(__name__)


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""

    _ALL_EVENT_TYPES = frozenset(
        ["earthquake", "hurricane", "wildfire", "tornado", "flooding", "hail"]
    )

    def __init__(self) -> None:
        self.active_connections: Set[WebSocket] = set()
        self.subscriptions: Dict[WebSocket, List[str]] = {}

    async def connect(self, websocket: WebSocket) -> None:
        await websocket.accept()
        self.active_connections.add(websocket)
        self.subscriptions[websocket] = list(self._ALL_EVENT_TYPES)

    def disconnect(self, websocket: WebSocket) -> None:
        self.active_connections.discard(websocket)
        self.subscriptions.pop(websocket, None)

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

    def subscribe(self, websocket: WebSocket, event_types: List[str]) -> None:
        """Update subscription preferences for a client."""
        self.subscriptions[websocket] = event_types


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

                if action == "subscribe":
                    events = message.get("events", [])
                    manager.subscribe(websocket, events)
                    await manager.send_personal_message(
                        {"type": "subscribed", "events": events}, websocket
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
