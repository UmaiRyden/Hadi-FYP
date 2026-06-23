"""
Sanity check: confirm the WhatsApp retrain did NOT break Facebook/Instagram/YouTube.
Compares OLD model (traffic_classifier_prev.pkl) vs NEW (traffic_classifier_final.pkl)
on a few real PCAPs per app.  Read-only — saves nothing.
"""
import os
import sys

import joblib
import numpy as np

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from services.pcap_parser import parse_pcap
from services.feature_extractor import extract_all_features, FEATURE_NAMES

MODELS_DIR = os.path.join(BASE_DIR, "models")
OLD_PATH   = os.path.join(MODELS_DIR, "traffic_classifier_prev.pkl")
NEW_PATH   = os.path.join(MODELS_DIR, "traffic_classifier_final.pkl")

# label -> list of real PCAP files
FILES = {
    "FACEBOOK":  [r"D:\Downloads\NonVPN-PCAPs-01\facebook_audio1a.pcap",
                  r"D:\Downloads\NonVPN-PCAPs-01\facebook_chat_4a.pcap",
                  r"D:\Downloads\NonVPN-PCAPs-01\facebook_video1a.pcap",
                  r"D:\Downloads\Facebook_3.pcap\Facebook_3.pcap"],
    "INSTAGRAM": [r"D:\Downloads\insta\instagram2.pcap",
                  r"D:\Downloads\insta\instagram3.pcap"],
    "YOUTUBE":   [r"D:\Downloads\youtube.pcap",
                  r"D:\Downloads\youtube_PCAPdroid_23_Apr_01_46_41.pcap"],
}


def _matrix_X(feats):
    X = np.array([[f[n] for n in FEATURE_NAMES] for f in feats], dtype=float)
    if X.size:
        X[~np.isfinite(X)] = 0.0
    return X


def _rate(model, X, label):
    if len(X) == 0:
        return 0.0, "-"
    preds = model.predict(X)
    vals, counts = np.unique(preds, return_counts=True)
    return float(np.mean(preds == label)) * 100, vals[int(np.argmax(counts))]


def main():
    old = joblib.load(OLD_PATH)
    new = joblib.load(NEW_PATH)
    print("OLD = traffic_classifier_prev.pkl   NEW = traffic_classifier_final.pkl\n")
    print(f"  {'file':40}{'truth':10}{'flows':>7}{'OLD %hit':>10}{'OLD top':>11}{'NEW %hit':>10}{'NEW top':>11}{'  OK?'}")
    print("  " + "-" * 104)
    all_ok = True
    for label, files in FILES.items():
        for path in files:
            name = os.path.basename(path)
            if not os.path.exists(path):
                print(f"  {name:40}{label:10}  MISSING — skipped")
                continue
            try:
                flows, _ = parse_pcap(path)
                X = _matrix_X(extract_all_features(flows))
            except Exception as exc:
                print(f"  {name:40}{label:10}  ERROR: {exc}")
                all_ok = False
                continue
            o_hit, o_top = _rate(old, X, label)
            n_hit, n_top = _rate(new, X, label)
            ok = (n_top == label)
            all_ok = all_ok and ok
            print(f"  {name:40}{label:10}{X.shape[0]:>7}"
                  f"{o_hit:>9.1f}%{o_top:>11}{n_hit:>9.1f}%{n_top:>11}"
                  f"{'   PASS' if ok else '   FAIL'}")
    print("\n  %hit = share of flows predicted as the file's true app. 'top' = majority-vote app.")
    print("  PASS = NEW model's majority vote still equals the true app.")
    print("\n  RESULT:", "ALL APPS STILL CLASSIFY CORRECTLY" if all_ok else "REGRESSION DETECTED")
    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
