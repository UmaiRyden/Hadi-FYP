"""
WebSocket endpoint for live packet capture streaming.

Architecture:
  - live_agent.py connects with ?role=agent and pushes flow feature dicts
  - Browser clients connect (default role=client) and receive classified results
  - The backend classifies agent data and broadcasts to every connected client
"""
import asyncio
import json
from typing import Dict, List, Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

router = APIRouter()


class CaptureManager:
    def __init__(self) -> None:
        self.agent: Optional[WebSocket] = None
        self.clients: List[WebSocket] = []
        self.total_flows: int = 0

    # ── Agent management ───────────────────────────────────────────────────
    async def connect_agent(self, ws: WebSocket) -> None:
        if self.agent is not None:
            try:
                await self.agent.close()
            except Exception:
                pass
        self.agent = ws
        await self._broadcast_status()

    async def disconnect_agent(self) -> None:
        self.agent = None
        await self._broadcast_status()

    # ── Client management ──────────────────────────────────────────────────
    async def connect_client(self, ws: WebSocket) -> None:
        self.clients.append(ws)
        await ws.send_json({
            "type": "status",
            "agent_connected": self.agent is not None,
            "total_flows": self.total_flows,
        })

    def disconnect_client(self, ws: WebSocket) -> None:
        self.clients = [c for c in self.clients if c is not ws]

    # ── Classification + broadcast ─────────────────────────────────────────
    async def process_agent_data(self, features: List[Dict]) -> None:
        if not features:
            return

        # Run CPU-bound classifier off the event loop
        loop = asyncio.get_event_loop()
        from services.classifier import classify_flows_detailed
        result = await loop.run_in_executor(None, classify_flows_detailed, features)

        self.total_flows += result["flow_count"]

        payload = {
            "type": "result",
            "predicted_app": result["predicted_app"],
            "confidence": result["confidence"],
            "flow_count": result["flow_count"],
            "total_flows": self.total_flows,
            "vpn_detected": result["vpn_detected"],
            "predictions": result["predictions"],
        }

        await self._broadcast(payload)

    # ── Helpers ────────────────────────────────────────────────────────────
    async def _broadcast(self, payload: dict) -> None:
        dead: List[WebSocket] = []
        for client in self.clients:
            try:
                await client.send_json(payload)
            except Exception:
                dead.append(client)
        for d in dead:
            self.disconnect_client(d)

    async def _broadcast_status(self) -> None:
        await self._broadcast({
            "type": "status",
            "agent_connected": self.agent is not None,
            "total_flows": self.total_flows,
        })


manager = CaptureManager()


@router.websocket("/ws/capture")
async def capture_endpoint(ws: WebSocket, role: str = "client") -> None:
    await ws.accept()

    if role == "agent":
        await manager.connect_agent(ws)
        try:
            while True:
                raw = await ws.receive_text()
                msg = json.loads(raw)
                if msg.get("type") == "flows":
                    await manager.process_agent_data(msg.get("data", []))
        except WebSocketDisconnect:
            pass
        finally:
            await manager.disconnect_agent()
    else:
        await manager.connect_client(ws)
        try:
            while True:
                # Clients only receive; keep connection alive
                await ws.receive_text()
        except WebSocketDisconnect:
            pass
        finally:
            manager.disconnect_client(ws)
