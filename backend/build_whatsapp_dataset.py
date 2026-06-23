"""
Extract fresh WhatsApp capture features (EXTRACTION ONLY — no retraining).

Pipeline (steps 1-4 of the standard retraining method):
  1. Read the 4 fresh WhatsApp browser PCAPs from backend/fresh_data/whatsapp/
  2. Extract the 18 features per flow (services/feature_extractor.py) from each file.
  3. Cap ANY single file producing > 3,000 flows to 3,000 (random_state=42 sample).
  4. Label every flow WHATSAPP and save -> backend/fresh_whatsapp_data.csv

Then STOP and report per-file + total flow counts. Retraining is a separate step.

Usage:  python build_whatsapp_dataset.py
"""
import os
import sys

import pandas as pd

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from services.pcap_parser import parse_pcap
from services.feature_extractor import extract_all_features, FEATURE_NAMES

WHATSAPP_DIR = os.path.join(BASE_DIR, "fresh_data", "whatsapp")
OUT_CSV      = os.path.join(BASE_DIR, "fresh_whatsapp_data.csv")
LABEL_COL    = "ProtocolName"
LABEL        = "WHATSAPP"
PER_FILE_CAP = 3000
MIN_TOTAL    = 500


def banner(title):
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def extract_file(path):
    """Extract + per-file cap. Returns (labelled DataFrame, raw_flow_count)."""
    flows, _ = parse_pcap(path)
    feats = extract_all_features(flows)
    rows = [
        {**{n: f[n] for n in FEATURE_NAMES}, LABEL_COL: LABEL,
         "source_file": os.path.basename(path)}
        for f in feats
    ]
    fdf = pd.DataFrame(rows, columns=FEATURE_NAMES + [LABEL_COL, "source_file"])
    raw = len(fdf)
    if raw > PER_FILE_CAP:
        fdf = fdf.sample(n=PER_FILE_CAP, random_state=42).reset_index(drop=True)
    return fdf, raw


def main():
    banner("STEP 1-3  Extracting 18 features from fresh WhatsApp PCAPs")
    if not os.path.isdir(WHATSAPP_DIR):
        sys.exit(f"Missing directory: {WHATSAPP_DIR}")

    files = sorted(
        os.path.join(WHATSAPP_DIR, f) for f in os.listdir(WHATSAPP_DIR)
        if f.lower().endswith((".pcap", ".pcapng"))
    )
    if not files:
        sys.exit(f"No PCAP files found in {WHATSAPP_DIR}")

    frames = []
    report = []  # (basename, raw, kept)
    for path in files:
        name = os.path.basename(path)
        try:
            fdf, raw = extract_file(path)
        except Exception as exc:
            print(f"  ! {name:24} SKIPPED ({exc})")
            report.append((name, "ERROR", 0))
            continue
        kept = len(fdf)
        capped = "  -> CAPPED to 3000 (random_state=42)" if raw > PER_FILE_CAP else ""
        print(f"  + {name:24} raw {raw:6d} flows -> kept {kept:6d}{capped}")
        report.append((name, raw, kept))
        if kept:
            frames.append(fdf)

    if not frames:
        sys.exit("No WhatsApp flows extracted — aborting.")

    combined = pd.concat(frames, ignore_index=True)

    banner("STEP 4  Saving fresh WhatsApp CSV")
    combined.to_csv(OUT_CSV, index=False)
    print(f"  Wrote {len(combined)} rows -> {OUT_CSV}")

    banner("SUMMARY  flow count per file (post-cap)")
    print(f"  {'file':28}{'raw':>10}{'kept':>10}")
    print("  " + "-" * 48)
    total = 0
    for name, raw, kept in report:
        print(f"  {name:28}{str(raw):>10}{kept:>10}")
        if isinstance(kept, int):
            total += kept
    print("  " + "-" * 48)
    print(f"  {'TOTAL (saved to CSV)':28}{'':>10}{total:>10}")

    banner("GATE  minimum total flow check")
    if total < MIN_TOTAL:
        print(f"  [LOW] Total {total} flows < {MIN_TOTAL} minimum.")
        print(f"  Recommendation: capture more WhatsApp traffic before retraining.")
    else:
        print(f"  [OK] Total {total} flows >= {MIN_TOTAL} minimum. Ready to retrain on confirmation.")

    print("\nDONE — extraction only. NO retraining performed. Awaiting confirmation.")


if __name__ == "__main__":
    main()
