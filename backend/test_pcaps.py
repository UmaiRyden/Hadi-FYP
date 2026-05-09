"""
Batch PCAP tester — sends every .pcap/.pcapng file in a folder to POST /api/classify
and prints results in a formatted table with a prediction-distribution summary.

Usage:
    python test_pcaps.py
    python test_pcaps.py --dir "D:/Downloads/NonVPN-PCAPs-01" --url http://192.168.1.123:8000
    python test_pcaps.py --min-confidence 80
"""

import argparse
import sys
import time
from collections import Counter
from pathlib import Path

import requests

# ── defaults ──────────────────────────────────────────────────────────────────
DEFAULT_DIR = r"D:\Downloads\NonVPN-PCAPs-01"
DEFAULT_URL = "http://192.168.1.123:8000"
ENDPOINT    = "/api/classify"
TIMEOUT     = 120  # seconds per request

# ── ANSI colours (disabled automatically on Windows if not supported) ─────────
try:
    import colorama
    colorama.init(autoreset=True)
    GREEN  = colorama.Fore.GREEN
    RED    = colorama.Fore.RED
    YELLOW = colorama.Fore.YELLOW
    CYAN   = colorama.Fore.CYAN
    RESET  = colorama.Style.RESET_ALL
except ImportError:
    GREEN = RED = YELLOW = CYAN = RESET = ""

APP_COLOURS = {
    "FACEBOOK":  "\033[94m",   # blue
    "YOUTUBE":   "\033[91m",   # red
    "WHATSAPP":  "\033[92m",   # green
    "INSTAGRAM": "\033[95m",   # magenta
}


def colourise_app(app: str) -> str:
    colour = APP_COLOURS.get(app.upper(), "")
    return f"{colour}{app}{RESET}" if colour else app


def collect_pcaps(directory: Path) -> list[Path]:
    files = sorted(
        p for p in directory.rglob("*")
        if p.suffix.lower() in {".pcap", ".pcapng"} and p.is_file()
    )
    return files


def classify(url: str, pcap_path: Path) -> dict:
    with pcap_path.open("rb") as fh:
        response = requests.post(
            url,
            files={"file": (pcap_path.name, fh, "application/octet-stream")},
            timeout=TIMEOUT,
        )
    response.raise_for_status()
    return response.json()


def fmt_conf(conf) -> str:
    try:
        return f"{float(conf):6.2f}%"
    except (TypeError, ValueError):
        return "   N/A"


def print_header():
    print(
        f"\n{'FILE':<40} {'PREDICTED APP':<14} {'CONFIDENCE':>11} "
        f"{'FLOWS':>7} {'VPN':>5} {'TIME':>7}"
    )
    print("-" * 92)


def print_row(name: str, app: str, conf, flows, vpn: bool, elapsed: float,
              error: str = ""):
    if error:
        print(f"{RED}{name:<40}{RESET}  {RED}{error}{RESET}")
        return

    vpn_str = f"{YELLOW}YES{RESET}" if vpn else f"{GREEN} NO{RESET}"
    print(
        f"{name:<40} {colourise_app(app):<14} {fmt_conf(conf):>11} "
        f"{flows:>7} {vpn_str:>5} {elapsed:>6.1f}s"
    )


def print_summary(results: list[dict], errors: list[str], total_time: float,
                  min_confidence: float = 0.0):
    successes   = [r for r in results if not r.get("error")]
    above_thresh = [r for r in successes if float(r.get("confidence", 0)) > min_confidence]

    print("\n" + "=" * 92)
    print(f"  SUMMARY -- {len(results)} files processed in {total_time:.1f}s")
    print("=" * 92)

    if min_confidence > 0:
        colour = GREEN if above_thresh else RED
        print(
            f"\n  Confidence filter : > {min_confidence:.0f}%  |  "
            f"{colour}{len(above_thresh)} passed{RESET} out of "
            f"{len(successes)} successful ({len(results)} total)"
        )

    display = above_thresh if min_confidence > 0 else successes

    if display:
        app_counter: Counter = Counter(r["predicted_app"] for r in display)
        vpn_count   = sum(1 for r in display if r.get("vpn_detected"))
        total_flows = sum(r.get("flow_count", 0) for r in display)

        label = f"{len(display)} above {min_confidence:.0f}%" if min_confidence > 0 else f"{len(display)} successful"
        print(f"\n  Prediction distribution ({label}):\n")
        bar_total = sum(app_counter.values())
        for app, count in app_counter.most_common():
            bar_len = int(count / bar_total * 40)
            bar     = "#" * bar_len
            pct     = count / bar_total * 100
            print(f"    {colourise_app(app):<14}  {bar:<40}  {count:>3}  ({pct:5.1f}%)")

        print(f"\n  VPN-flagged files : {YELLOW if vpn_count else GREEN}{vpn_count}{RESET}")
        print(f"  Total flows       : {total_flows}")
        avg_conf = sum(float(r.get("confidence", 0)) for r in display) / len(display)
        print(f"  Avg confidence    : {avg_conf:.2f}%")

    if errors:
        print(f"\n  {RED}Failed files ({len(errors)}):{RESET}")
        for e in errors:
            print(f"    {RED}x{RESET} {e}")

    print()


def main():
    parser = argparse.ArgumentParser(description="Batch PCAP classifier tester")
    parser.add_argument("--dir", default=DEFAULT_DIR,
                        help="Directory containing PCAP files (recursive scan)")
    parser.add_argument("--url", default=DEFAULT_URL,
                        help="Backend base URL (default: http://192.168.1.123:8000)")
    parser.add_argument("--min-confidence", type=float, default=0.0, metavar="PCT",
                        help="Only display results where confidence > PCT (e.g. 80)")
    args = parser.parse_args()

    pcap_dir       = Path(args.dir)
    api_url        = args.url.rstrip("/") + ENDPOINT
    min_confidence = args.min_confidence

    if not pcap_dir.exists():
        print(f"{RED}Directory not found: {pcap_dir}{RESET}")
        sys.exit(1)

    pcaps = collect_pcaps(pcap_dir)
    if not pcaps:
        print(f"{YELLOW}No .pcap/.pcapng files found in {pcap_dir}{RESET}")
        sys.exit(0)

    print(f"\n{CYAN}Target directory :{RESET} {pcap_dir}")
    print(f"{CYAN}API endpoint     :{RESET} {api_url}")
    print(f"{CYAN}Files found      :{RESET} {len(pcaps)}")
    if min_confidence > 0:
        print(f"{CYAN}Confidence filter:{RESET} > {min_confidence:.0f}%  (all files are sent; only matching rows shown)")

    print_header()

    results: list[dict] = []
    errors:  list[str]  = []
    wall_start = time.time()

    for pcap in pcaps:
        name = pcap.name
        t0   = time.time()
        try:
            data    = classify(api_url, pcap)
            elapsed = time.time() - t0

            app   = data.get("predicted_app", "UNKNOWN")
            conf  = data.get("confidence", 0)
            flows = data.get("flow_count", 0)
            vpn   = bool(data.get("vpn_detected", False))

            results.append({
                "filename":      name,
                "predicted_app": app,
                "confidence":    conf,
                "flow_count":    flows,
                "vpn_detected":  vpn,
                "elapsed":       elapsed,
            })
            if float(conf) > min_confidence:
                print_row(name, app, conf, flows, vpn, elapsed)

        except requests.exceptions.ConnectionError:
            elapsed = time.time() - t0
            msg = "Connection refused - is the backend running?"
            print_row(name, "", 0, 0, False, elapsed, error=msg)
            errors.append(f"{name}: {msg}")
            results.append({"filename": name, "error": msg})

        except requests.exceptions.Timeout:
            elapsed = time.time() - t0
            msg = f"Timed out after {TIMEOUT}s"
            print_row(name, "", 0, 0, False, elapsed, error=msg)
            errors.append(f"{name}: {msg}")
            results.append({"filename": name, "error": msg})

        except requests.exceptions.HTTPError as exc:
            elapsed = time.time() - t0
            msg = f"HTTP {exc.response.status_code}: {exc.response.text[:80]}"
            print_row(name, "", 0, 0, False, elapsed, error=msg)
            errors.append(f"{name}: {msg}")
            results.append({"filename": name, "error": msg})

        except Exception as exc:  # noqa: BLE001
            elapsed = time.time() - t0
            msg = str(exc)
            print_row(name, "", 0, 0, False, elapsed, error=msg)
            errors.append(f"{name}: {msg}")
            results.append({"filename": name, "error": msg})

    print_summary(results, errors, time.time() - wall_start, min_confidence)


if __name__ == "__main__":
    main()
