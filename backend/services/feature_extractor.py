"""
Feature Extractor — computes the 15 traffic features per flow that
the ML model expects, matching the Unicauca dataset (CICFlowMeter) conventions.

Features (in model order):
  1.  Bwd.IAT.Total             — sum of backward inter-arrival times (µs)
  2.  Avg.Fwd.Segment.Size      — mean TCP payload size of forward packets
  3.  Fwd.Packet.Length.Mean    — mean total length of forward packets
  4.  Init_Win_bytes_forward    — TCP window of first forward packet
  5.  Destination.Port          — destination port of the flow
  6.  Fwd.Header.Length         — total IP+TCP header bytes (forward)
  7.  Bwd.IAT.Max               — max backward inter-arrival time (µs)
  8.  Bwd.IAT.Std               — std of backward inter-arrival times (µs)
  9.  Total.Length.of.Fwd.Packets — sum of forward payload bytes
  10. Subflow.Fwd.Bytes         — forward bytes in subflow (= Total.Length.of.Fwd.Packets)
  11. Source.Port               — source port of the flow
  12. Bwd.IAT.Mean              — mean backward inter-arrival time (µs)
  13. Fwd.Packet.Length.Max     — max total length of forward packets
  14. Fwd.IAT.Total             — sum of forward inter-arrival times (µs)
  15. Flow.Duration             — time from first to last packet (µs)
  16. Flow.Bytes.s              — total bytes / flow duration in seconds
  17. Flow.Packets.s            — total packets / flow duration in seconds
  18. Down.Up.Ratio             — backward packets / forward packets

IAT and duration values are in microseconds, matching CICFlowMeter output.
"""
from typing import Dict, List, Optional

import numpy as np


FEATURE_NAMES = [
    "Bwd.IAT.Total",
    "Avg.Fwd.Segment.Size",
    "Fwd.Packet.Length.Mean",
    "Init_Win_bytes_forward",
    "Destination.Port",
    "Fwd.Header.Length",
    "Bwd.IAT.Max",
    "Bwd.IAT.Std",
    "Total.Length.of.Fwd.Packets",
    "Subflow.Fwd.Bytes",
    "Source.Port",
    "Bwd.IAT.Mean",
    "Fwd.Packet.Length.Max",
    "Fwd.IAT.Total",
    "Flow.Duration",
    "Flow.Bytes.s",
    "Flow.Packets.s",
    "Down.Up.Ratio",
]


def _iats_us(timestamps_sec: List[float]) -> List[float]:
    """Return inter-arrival times in microseconds from sorted timestamps."""
    return [
        (timestamps_sec[i + 1] - timestamps_sec[i]) * 1_000_000
        for i in range(len(timestamps_sec) - 1)
    ]


def extract_features(flow_key: tuple, flow_data: dict) -> Optional[Dict]:
    """
    Extract the 15 model features from a single flow.

    flow_key: (src_ip, src_port, dst_ip, dst_port, proto)
    flow_data: {"fwd_is_a_to_b": bool, "packets": [...]}

    Returns None if the flow has no forward packets (not useful for classification).
    """
    packets = flow_data["packets"]
    if not packets:
        return None

    # src_port = canonical source port, dst_port = canonical dest port
    _, src_port, _, dst_port, _ = flow_key

    fwd = [p for p in packets if p["direction"] == "fwd"]
    bwd = [p for p in packets if p["direction"] == "bwd"]

    if not fwd:
        return None

    all_times = sorted(p["time"] for p in packets)
    fwd_times = sorted(p["time"] for p in fwd)
    bwd_times = sorted(p["time"] for p in bwd)

    # ── Flow duration ───────────────────────────────────────────────────────────
    flow_duration = (all_times[-1] - all_times[0]) * 1_000_000  # µs

    # ── Forward features ────────────────────────────────────────────────────────
    fwd_sizes        = [p["size"]         for p in fwd]
    fwd_payloads     = [p["payload_size"] for p in fwd]
    fwd_headers      = [p["header_size"]  for p in fwd]

    fwd_pkt_len_mean    = float(np.mean(fwd_sizes))
    fwd_pkt_len_max     = float(max(fwd_sizes))
    total_len_fwd       = int(sum(fwd_payloads))
    subflow_fwd_bytes   = total_len_fwd
    avg_fwd_segment     = float(np.mean(fwd_payloads)) if fwd_payloads else 0.0
    fwd_header_length   = int(sum(fwd_headers))
    init_win_fwd        = int(fwd[0]["tcp_window"])   # window of first fwd packet

    # ── Forward IATs ────────────────────────────────────────────────────────────
    fwd_iats      = _iats_us(fwd_times)
    fwd_iat_total = float(sum(fwd_iats))

    # ── Backward IATs ───────────────────────────────────────────────────────────
    bwd_iats      = _iats_us(bwd_times)
    bwd_iat_total = float(sum(bwd_iats))
    bwd_iat_mean  = float(np.mean(bwd_iats))  if bwd_iats else 0.0
    bwd_iat_std   = float(np.std(bwd_iats))   if bwd_iats else 0.0
    bwd_iat_max   = float(max(bwd_iats))      if bwd_iats else 0.0

    # ── Flow rate features ──────────────────────────────────────────────────────
    duration_sec    = flow_duration / 1_000_000  # convert µs back to seconds
    total_bytes_all = sum(p["size"] for p in packets)
    total_pkts_all  = len(packets)

    flow_bytes_s   = total_bytes_all / duration_sec  if duration_sec > 0 else 0.0
    flow_packets_s = total_pkts_all  / duration_sec  if duration_sec > 0 else 0.0
    down_up_ratio  = len(bwd) / len(fwd)             if fwd              else 0.0

    return {
        "Bwd.IAT.Total":               bwd_iat_total,
        "Avg.Fwd.Segment.Size":        avg_fwd_segment,
        "Fwd.Packet.Length.Mean":      fwd_pkt_len_mean,
        "Init_Win_bytes_forward":      init_win_fwd,
        "Destination.Port":            dst_port,
        "Fwd.Header.Length":           fwd_header_length,
        "Bwd.IAT.Max":                 bwd_iat_max,
        "Bwd.IAT.Std":                 bwd_iat_std,
        "Total.Length.of.Fwd.Packets": total_len_fwd,
        "Subflow.Fwd.Bytes":           subflow_fwd_bytes,
        "Source.Port":                 src_port,
        "Bwd.IAT.Mean":                bwd_iat_mean,
        "Fwd.Packet.Length.Max":       fwd_pkt_len_max,
        "Fwd.IAT.Total":               fwd_iat_total,
        "Flow.Duration":               flow_duration,
        "Flow.Bytes.s":                flow_bytes_s,
        "Flow.Packets.s":              flow_packets_s,
        "Down.Up.Ratio":               down_up_ratio,
    }


def extract_all_features(flows: Dict[tuple, dict]) -> List[Dict]:
    """
    Run extract_features over every flow and return only valid results.
    Each returned dict includes the flow_key as a string for traceability.
    """
    results = []
    for flow_key, flow_data in flows.items():
        features = extract_features(flow_key, flow_data)
        if features is not None:
            features["flow_key"]  = str(flow_key)
            features["source_ip"] = flow_key[0]   # canonical src IP for device grouping
            results.append(features)
    return results
