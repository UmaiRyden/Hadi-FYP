#!/usr/bin/env python3
"""
Live Capture Agent — sniffs live packets and streams classified flow features
to the FastAPI backend over WebSocket.

Usage:
  python live_agent.py [--url ws://localhost:8000/ws/capture?role=agent]
                       [--iface "Wi-Fi"]
                       [--interval 2.5]

Requirements:
  Windows : Npcap installed  (https://npcap.com)
  Linux   : run as root / with CAP_NET_RAW
  pip install scapy websockets
"""
import argparse
import asyncio
import json
import math
import os
import socket
import sys
import threading
from collections import defaultdict
from typing import Dict, List, Optional, Tuple

# ── Path setup so we can import from services/ ─────────────────────────────
sys.path.insert(0, os.path.dirname(__file__))


# ── Interface auto-detection ───────────────────────────────────────────────

def _local_ip() -> Optional[str]:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.settimeout(0)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return None


def detect_interface() -> Tuple[Optional[str], Optional[str]]:
    """Return (scapy_iface_name, local_ip) for the active outbound interface."""
    local_ip = _local_ip()
    if not local_ip:
        return None, None

    try:
        from scapy.all import get_if_list, get_if_addr
        for iface in get_if_list():
            try:
                if get_if_addr(iface) == local_ip:
                    return iface, local_ip
            except Exception:
                continue
    except Exception:
        pass

    return None, local_ip


# ── Flow building (mirrors pcap_parser.py) ─────────────────────────────────

def _build_flow_key(src_ip, src_port, dst_ip, dst_port, proto):
    ep_a = (src_ip, src_port)
    ep_b = (dst_ip, dst_port)
    if ep_a <= ep_b:
        return (src_ip, src_port, dst_ip, dst_port, proto), True
    return (dst_ip, dst_port, src_ip, src_port, proto), False


def packets_to_flows(raw_packets: list) -> Dict:
    """Convert buffered scapy packets into the same flow dict as pcap_parser.py."""
    try:
        from scapy.all import IP, TCP, UDP
    except ImportError:
        return {}

    flows: Dict = {}
    for pkt in raw_packets:
        if IP not in pkt:
            continue
        if TCP not in pkt and UDP not in pkt:
            continue

        is_tcp = TCP in pkt
        proto = "TCP" if is_tcp else "UDP"
        src_ip = pkt[IP].src
        dst_ip = pkt[IP].dst
        src_port = pkt[TCP].sport if is_tcp else pkt[UDP].sport
        dst_port = pkt[TCP].dport if is_tcp else pkt[UDP].dport

        flow_key, pkt_is_a_to_b = _build_flow_key(src_ip, src_port, dst_ip, dst_port, proto)

        if flow_key not in flows:
            flows[flow_key] = {"fwd_is_a_to_b": pkt_is_a_to_b, "packets": []}

        direction = (
            "fwd" if pkt_is_a_to_b == flows[flow_key]["fwd_is_a_to_b"] else "bwd"
        )

        ip_hdr = pkt[IP].ihl * 4
        if is_tcp:
            tcp_hdr = pkt[TCP].dataofs * 4
            header_size = ip_hdr + tcp_hdr
            payload_size = max(0, pkt[IP].len - ip_hdr - tcp_hdr)
            tcp_window = pkt[TCP].window
        else:
            header_size = ip_hdr + 8
            payload_size = max(0, pkt[UDP].len - 8)
            tcp_window = 0

        flows[flow_key]["packets"].append({
            "size": len(pkt),
            "time": float(pkt.time),
            "direction": direction,
            "payload_size": payload_size,
            "header_size": header_size,
            "tcp_window": tcp_window,
        })

    return flows


def _sanitize(v):
    """Replace NaN/Inf with 0 so json.dumps never produces invalid JSON."""
    if isinstance(v, float) and (math.isnan(v) or math.isinf(v)):
        return 0.0
    return v


def features_to_json_safe(features: List[Dict]) -> List[Dict]:
    return [
        {k: (_sanitize(v) if isinstance(v, (int, float)) else v) for k, v in f.items()}
        for f in features
    ]


# ── Main agent logic ────────────────────────────────────────────────────────

async def run_once(iface: Optional[str], ws_url: str, interval: float) -> None:
    """
    Connect to the backend WebSocket, sniff packets, and stream features
    in FLUSH_INTERVAL-second batches until the connection drops.
    """
    try:
        import websockets
    except ImportError:
        print("ERROR: websockets library not installed.\n  pip install websockets")
        sys.exit(1)

    from scapy.all import AsyncSniffer
    from services.feature_extractor import extract_all_features

    packet_buffer: List = []
    lock = threading.Lock()

    def on_packet(pkt):
        with lock:
            packet_buffer.append(pkt)

    sniffer_kwargs: Dict = {"prn": on_packet, "store": False}
    if iface:
        sniffer_kwargs["iface"] = iface

    sniffer = AsyncSniffer(**sniffer_kwargs)
    sniffer.start()
    print(f"  Sniffing on: {iface or 'default interface'}")

    try:
        async with websockets.connect(ws_url) as ws:
            print(f"  Connected to backend: {ws_url}\n")
            batch_num = 0
            while True:
                await asyncio.sleep(interval)

                with lock:
                    pkts = packet_buffer.copy()
                    packet_buffer.clear()

                if not pkts:
                    continue

                flows = packets_to_flows(pkts)
                features = extract_all_features(flows)

                if not features:
                    print(f"  Batch {batch_num}: {len(pkts)} packets, 0 classifiable flows — skipped")
                    continue

                safe_features = features_to_json_safe(features)
                msg = json.dumps({"type": "flows", "data": safe_features})
                await ws.send(msg)
                batch_num += 1
                print(f"  Batch {batch_num}: {len(pkts)} packets → {len(features)} flows sent")
    finally:
        sniffer.stop()


async def main(iface: Optional[str], ws_url: str, interval: float) -> None:
    print("=== Traffic Classifier Live Agent ===")
    print(f"  Backend : {ws_url}")
    print(f"  Interval: {interval}s per batch")

    while True:
        try:
            await run_once(iface, ws_url, interval)
        except KeyboardInterrupt:
            print("\nStopped.")
            break
        except Exception as exc:
            print(f"  Connection error: {exc}")
            print("  Retrying in 5 seconds…")
            await asyncio.sleep(5)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Live traffic capture agent")
    parser.add_argument(
        "--url",
        default="ws://localhost:8000/ws/capture?role=agent",
        help="Backend WebSocket URL",
    )
    parser.add_argument(
        "--iface",
        default=None,
        help="Network interface name (auto-detected if omitted)",
    )
    parser.add_argument(
        "--interval",
        type=float,
        default=2.5,
        help="Seconds between classification batches (default: 2.5)",
    )
    args = parser.parse_args()

    iface = args.iface
    if not iface:
        iface, local_ip = detect_interface()
        if local_ip:
            print(f"Auto-detected local IP : {local_ip}")
        if iface:
            print(f"Auto-detected interface: {iface}")
        else:
            print("Could not auto-detect interface — using scapy default")

    asyncio.run(main(iface, args.url, args.interval))
