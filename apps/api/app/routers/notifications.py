"""
Real-time notifications via WebSocket.
"""
from typing import List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from datetime import datetime
import json

router = APIRouter()


class ConnectionManager:
    """Manages WebSocket connections for real-time updates."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.subscriptions: dict = {}  # websocket -> list of event types
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        self.subscriptions[websocket] = ["earthquake", "hurricane"]  # Default: all
    
    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)
        if websocket in self.subscriptions:
            del self.subscriptions[websocket]
    
    async def send_personal_message(self, message: dict, websocket: WebSocket):
        await websocket.send_json(message)
    
    async def broadcast(self, message: dict, event_type: str = None):
        """Broadcast message to all connected clients (optionally filtered by subscription)."""
        for connection in self.active_connections:
            try:
                # Check if client is subscribed to this event type
                if event_type and event_type not in self.subscriptions.get(connection, []):
                    continue
                await connection.send_json(message)
            except Exception:
                # Connection might be closed
                pass
    
    def subscribe(self, websocket: WebSocket, event_types: List[str]):
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
    - {"type": "ping", "timestamp": "..."}
    """
    await manager.connect(websocket)
    
    # Send welcome message
    await manager.send_personal_message({
        "type": "connected",
        "message": "Connected to Catastrophe Mapping real-time feed",
        "timestamp": datetime.utcnow().isoformat(),
    }, websocket)
    
    try:
        while True:
            # Receive messages from client
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                action = message.get("action")
                
                if action == "subscribe":
                    events = message.get("events", [])
                    manager.subscribe(websocket, events)
                    await manager.send_personal_message({
                        "type": "subscribed",
                        "events": events,
                    }, websocket)
                
                elif action == "ping":
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.utcnow().isoformat(),
                    }, websocket)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "Invalid JSON",
                }, websocket)
                
    except WebSocketDisconnect:
        manager.disconnect(websocket)


async def notify_earthquake(earthquake_data: dict):
    """
    Send earthquake notification to all subscribed clients.
    Called by the earthquake ingestion service when new event is detected.
    """
    await manager.broadcast({
        "type": "earthquake",
        "data": earthquake_data,
        "timestamp": datetime.utcnow().isoformat(),
    }, event_type="earthquake")


async def notify_hurricane(hurricane_data: dict):
    """
    Send hurricane notification to all subscribed clients.
    Called by the hurricane ingestion service when update is detected.
    """
    await manager.broadcast({
        "type": "hurricane",
        "data": hurricane_data,
        "timestamp": datetime.utcnow().isoformat(),
    }, event_type="hurricane")
