"""
PCAP Parser — reads a .pcap/.pcapng file with scapy and groups
IP/TCP/UDP packets into bidirectional flows.

Each flow value is a dict:
  {
    "fwd_is_a_to_b": bool,   # True if forward dir = canonical src→dst
    "packets": [
      {
        "size":         int,    # total packet length (bytes)
        "time":         float,  # Unix timestamp (seconds)
        "direction":    str,    # "fwd" | "bwd"
        "payload_size": int,    # transport-layer payload bytes
        "header_size":  int,    # IP + transport header bytes
        "tcp_window":   int,    # TCP window value (0 for UDP)
      },
      ...
    ]
  }

Flow key: (src_ip, src_port, dst_ip, dst_port, proto)
  where (src_ip, src_port) <= (dst_ip, dst_port) lexicographically.
"""
from collections import defaultdict
from typing import Dict, List, Tuple


def parse_pcap(file_path: str) -> Tuple[Dict[tuple, dict], int]:
    """
    Parse a PCAP file and return (flows, total_packet_count).

    flows: {flow_key: {"fwd_is_a_to_b": bool, "packets": [...]}}
    """
    try:
        from scapy.all import rdpcap, IP, TCP, UDP
    except ImportError:
        raise RuntimeError("scapy is not installed. Run: pip install scapy")

    packets = rdpcap(file_path)
    flows: Dict[tuple, dict] = {}
    total_packets = 0

    for pkt in packets:
        if IP not in pkt:
            continue
        if TCP not in pkt and UDP not in pkt:
            continue

        total_packets += 1
        is_tcp = TCP in pkt
        proto = "TCP" if is_tcp else "UDP"

        src_ip   = pkt[IP].src
        dst_ip   = pkt[IP].dst
        src_port = pkt[TCP].sport if is_tcp else pkt[UDP].sport
        dst_port = pkt[TCP].dport if is_tcp else pkt[UDP].dport

        # Canonical key: smaller endpoint always listed first
        ep_a = (src_ip, src_port)
        ep_b = (dst_ip, dst_port)
        pkt_is_a_to_b = ep_a <= ep_b

        if pkt_is_a_to_b:
            flow_key = (src_ip, src_port, dst_ip, dst_port, proto)
        else:
            flow_key = (dst_ip, dst_port, src_ip, src_port, proto)

        if flow_key not in flows:
            # First packet seen sets the forward direction
            flows[flow_key] = {"fwd_is_a_to_b": pkt_is_a_to_b, "packets": []}

        direction = (
            "fwd"
            if pkt_is_a_to_b == flows[flow_key]["fwd_is_a_to_b"]
            else "bwd"
        )

        # Compute header and payload sizes
        ip_hdr = pkt[IP].ihl * 4
        if is_tcp:
            tcp_hdr     = pkt[TCP].dataofs * 4
            header_size = ip_hdr + tcp_hdr
            payload_size = max(0, pkt[IP].len - ip_hdr - tcp_hdr)
            tcp_window  = pkt[TCP].window
        else:
            header_size  = ip_hdr + 8          # UDP header is always 8 bytes
            payload_size = max(0, pkt[UDP].len - 8)
            tcp_window   = 0

        flows[flow_key]["packets"].append(
            {
                "size":         len(pkt),
                "time":         float(pkt.time),
                "direction":    direction,
                "payload_size": payload_size,
                "header_size":  header_size,
                "tcp_window":   tcp_window,
            }
        )

    return flows, total_packets


def validate_pcap(file_path: str) -> bool:
    """Return True if the file is a readable, non-empty PCAP."""
    try:
        from scapy.all import rdpcap
        pkts = rdpcap(file_path)
        return len(pkts) > 0
    except Exception:
        return False
