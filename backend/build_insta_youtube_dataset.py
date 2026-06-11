"""
Augment the classifier with fresh Instagram + YouTube captures (gated).

Pipeline:
  1. Extract the 18 features per flow (services/feature_extractor.py) from:
       - Instagram PCAPs in D:\\Downloads\\insta
       - YouTube  PCAP   D:\\Downloads\\youtube.pcap
  2. Cap EACH app's fresh contribution to 5,000 flows (random_state=42 sample),
     pooled across that app's files, so no single capture dominates.
  3. Label Instagram flows INSTAGRAM, YouTube flows YOUTUBE.
  4. Save backend/fresh_instagram_data.csv and backend/fresh_youtube_data.csv
  5. Rebuild ../combined_dataset.csv from the stable base
       filtered_dataset_train.csv (YouTube capped at 30k)
       + fresh_facebook_data.csv  (already created)
       + fresh_instagram_data.csv + fresh_youtube_data.csv
     (idempotent — re-running can't double-add).
  6. Retrain RandomForest (class_weight='balanced', 80/20 stratified).
  7. Goals: WhatsApp F1 > 70% (hard gate); Facebook stays high; Instagram and
     YouTube improve or maintain.
  8. Before/after on the same test split, confusion matrix, and old-vs-new on a
     few fresh Instagram / YouTube PCAPs.
  9. Back up the CURRENT model to traffic_classifier_prev.pkl FIRST. Save the new
     model only if the WhatsApp gate passes. (Caller does not commit.)

Usage:  python build_insta_youtube_dataset.py
"""
import os
import shutil
import sys
import json
import math

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score, f1_score, confusion_matrix,
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, BASE_DIR)

from services.pcap_parser import parse_pcap
from services.feature_extractor import extract_all_features, FEATURE_NAMES

# ── Paths ────────────────────────────────────────────────────────────────────
ROOT_DIR       = os.path.dirname(BASE_DIR)
INSTA_DIR      = r"D:\Downloads\insta"
YOUTUBE_FILE   = r"D:\Downloads\youtube.pcap"
TRAIN_CSV      = os.path.join(ROOT_DIR, "filtered_dataset_train.csv")   # base (YouTube capped 30k)
FRESH_FB_CSV   = os.path.join(BASE_DIR, "fresh_facebook_data.csv")      # existing fresh Facebook
FRESH_INSTA_CSV = os.path.join(BASE_DIR, "fresh_instagram_data.csv")
FRESH_YT_CSV   = os.path.join(BASE_DIR, "fresh_youtube_data.csv")
COMBINED_CSV   = os.path.join(ROOT_DIR, "combined_dataset.csv")
MODELS_DIR     = os.path.join(BASE_DIR, "models")
MODEL_PATH     = os.path.join(MODELS_DIR, "traffic_classifier_final.pkl")
BASELINE_PATH  = os.path.join(MODELS_DIR, "traffic_classifier_prev.pkl")
METRICS_PATH   = os.path.join(MODELS_DIR, "model_metrics.json")

CLASSES   = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"]
LABEL_COL = "ProtocolName"
CAP       = 5000
WHATSAPP_F1_GATE = 70.0
# Fresh files for the old-vs-new spot check (label -> files)
SPOT_FILES = {
    "INSTAGRAM": [os.path.join(INSTA_DIR, "instagram2.pcap"),
                  os.path.join(INSTA_DIR, "instagram3.pcap")],
    "YOUTUBE":   [YOUTUBE_FILE],
}


def banner(title):
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def _matrix_X(feats):
    X = np.array([[f[n] for n in FEATURE_NAMES] for f in feats], dtype=float)
    if X.size:
        X[~np.isfinite(X)] = 0.0
    return X


# ── Steps 1-3 ────────────────────────────────────────────────────────────────
def extract_app(files, label):
    """Pool flows from an app's files, cap to 5,000, return labelled DataFrame."""
    frames = []
    for path in files:
        if not os.path.exists(path):
            print(f"  ! {os.path.basename(path):28} MISSING — skipped")
            continue
        try:
            flows, _ = parse_pcap(path)
            feats = extract_all_features(flows)
        except Exception as exc:
            print(f"  ! {os.path.basename(path):28} SKIPPED ({exc})")
            continue
        rows = [
            {**{n: f[n] for n in FEATURE_NAMES}, LABEL_COL: label,
             "source_file": os.path.basename(path)}
            for f in feats
        ]
        fdf = pd.DataFrame(rows, columns=FEATURE_NAMES + [LABEL_COL, "source_file"])
        print(f"  + {os.path.basename(path):28} {len(fdf):6d} flows")
        frames.append(fdf)

    if not frames:
        return pd.DataFrame(columns=FEATURE_NAMES + [LABEL_COL, "source_file"])

    pooled = pd.concat(frames, ignore_index=True)
    raw = len(pooled)
    if raw > CAP:
        pooled = pooled.sample(n=CAP, random_state=42).reset_index(drop=True)
        print(f"  = {label}: pooled {raw} flows  ->  CAPPED to {CAP} (random_state=42)")
    else:
        print(f"  = {label}: pooled {raw} flows  (<= {CAP}, no cap)")
    return pooled


# ── Step 5 ───────────────────────────────────────────────────────────────────
def build_combined(insta_df, yt_df):
    banner("STEP 5  Rebuilding combined_dataset.csv (train + facebook + insta + youtube)")
    parts = []
    for name, path in [("filtered_dataset_train.csv", TRAIN_CSV),
                       ("fresh_facebook_data.csv", FRESH_FB_CSV)]:
        if not os.path.exists(path):
            sys.exit(f"Required base file missing: {path}")
        df = pd.read_csv(path, usecols=FEATURE_NAMES + [LABEL_COL])
        print(f"  base  {name:32} {len(df):>7,} rows")
        parts.append(df)

    parts.append(insta_df[FEATURE_NAMES + [LABEL_COL]])
    parts.append(yt_df[FEATURE_NAMES + [LABEL_COL]])

    combined = pd.concat(parts, ignore_index=True)
    combined.replace([np.inf, -np.inf], np.nan, inplace=True)
    before = len(combined)
    combined.dropna(subset=FEATURE_NAMES, inplace=True)
    combined.to_csv(COMBINED_CSV, index=False)

    print(f"  fresh INSTAGRAM {len(insta_df):>7,} rows   fresh YOUTUBE {len(yt_df):>7,} rows")
    print(f"  Combined rows: {len(combined):,}  (dropped {before - len(combined)} NaN/inf)")
    print(f"  Wrote -> {COMBINED_CSV}\n  Combined class distribution:")
    for cls, n in combined[LABEL_COL].value_counts().items():
        print(f"    {cls:12} {n:,}")
    return combined


# ── Step 6 ───────────────────────────────────────────────────────────────────
def train(combined):
    banner("STEP 6  Training RandomForest (class_weight='balanced', 80/20)")
    X = combined[FEATURE_NAMES].values
    y = combined[LABEL_COL].values
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"  Train: {len(X_train):,}   Test: {len(X_test):,}")
    model = RandomForestClassifier(
        n_estimators=200, max_depth=15, random_state=42, n_jobs=-1, class_weight="balanced",
    )
    model.fit(X_train, y_train)
    return model, X_test, y_test


def _per_class_f1(y_true, y_pred):
    return {c: round(v * 100, 2)
            for c, v in zip(CLASSES, f1_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0))}


# ── Step 8 ───────────────────────────────────────────────────────────────────
def evaluate(model, X_test, y_test):
    banner("STEP 8  Evaluation on the 20% hold-out test set")
    y_pred = model.predict(X_test)
    cm = confusion_matrix(y_test, y_pred, labels=CLASSES)
    metrics = {
        "accuracy":  round(accuracy_score(y_test, y_pred) * 100, 2),
        "precision": round(precision_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "recall":    round(recall_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "f1_score":  round(f1_score(y_test, y_pred, average="weighted", zero_division=0) * 100, 2),
        "f1_per_class": _per_class_f1(y_test, y_pred),
        "confusion_matrix": {"labels": CLASSES, "matrix": cm.tolist()},
        "feature_count": len(FEATURE_NAMES), "feature_names": FEATURE_NAMES,
    }
    print(f"  Accuracy : {metrics['accuracy']}%   Precision: {metrics['precision']}%   "
          f"Recall: {metrics['recall']}%   F1: {metrics['f1_score']}%")

    baseline_f1 = None
    if os.path.exists(BASELINE_PATH):
        base = joblib.load(BASELINE_PATH)
        baseline_f1 = _per_class_f1(y_test, base.predict(X_test))

    print("\n  Per-class F1  (before = current model backed up to prev.pkl, same test set):")
    print(f"    {'class':12}{'BEFORE':>10}{'AFTER':>10}{'DELTA':>10}")
    for c in CLASSES:
        a = metrics["f1_per_class"][c]
        b = baseline_f1[c] if baseline_f1 else float("nan")
        d = f"{a - b:+.2f}" if baseline_f1 else "-"
        print(f"    {c:12}{b:>10.2f}{a:>10.2f}{d:>10}")

    print("\n  Confusion Matrix (rows=actual, cols=predicted):")
    print(f"{'':12}" + "".join(f"{c:>11}" for c in CLASSES))
    for label, row in zip(CLASSES, cm):
        print(f"{label:12}" + "".join(f"{v:>11,}" for v in row))
    return metrics


# ── Step 7 (gated) ───────────────────────────────────────────────────────────
def gate_and_save(model, metrics, n_train, n_test):
    banner("STEP 7  Gate check  (WhatsApp F1 >= 70% to save)")
    wf1 = metrics["f1_per_class"]["WHATSAPP"]
    print(f"  WhatsApp F1 = {wf1}%  (gate {WHATSAPP_F1_GATE}%)  -> {'PASS' if wf1 >= WHATSAPP_F1_GATE else 'FAIL'}")
    if wf1 < WHATSAPP_F1_GATE:
        print(f"\n  [FAIL] WhatsApp F1 {wf1}% < {WHATSAPP_F1_GATE}% -- MODEL NOT SAVED.")
        print(f"  Current model left in place at {MODEL_PATH} (== prev.pkl backup).")
        return False
    metrics["training_samples"] = n_train
    metrics["test_samples"] = n_test
    joblib.dump(model, MODEL_PATH)
    with open(METRICS_PATH, "w") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"\n  [OK] Saved new model -> {MODEL_PATH}")
    print(f"  Updated metrics      -> {METRICS_PATH}")
    return True


# ── Step 8 spot check ────────────────────────────────────────────────────────
def _rate(model, X, label):
    if len(X) == 0:
        return 0.0, "-"
    preds = model.predict(X)
    vals, counts = np.unique(preds, return_counts=True)
    return float(np.mean(preds == label)) * 100, vals[int(np.argmax(counts))]


def spot_check(new_model):
    banner("STEP 8b  BEFORE (prev.pkl) vs AFTER (new) on fresh Instagram/YouTube PCAPs")
    if not os.path.exists(BASELINE_PATH):
        print("  No baseline — skipping.")
        return
    old = joblib.load(BASELINE_PATH)
    print(f"  {'file':24}{'label':10}{'flows':>7}{'OLD %hit':>10}{'OLD top':>11}{'NEW %hit':>10}{'NEW top':>11}")
    print("  " + "-" * 83)
    for label, files in SPOT_FILES.items():
        for path in files:
            if not os.path.exists(path):
                continue
            try:
                flows, _ = parse_pcap(path)
                X = _matrix_X(extract_all_features(flows))
            except Exception as exc:
                print(f"  {os.path.basename(path):24}  ERROR: {exc}")
                continue
            o_hit, o_top = _rate(old, X, label)
            n_hit, n_top = _rate(new_model, X, label)
            print(f"  {os.path.basename(path):24}{label:10}{X.shape[0]:>7}"
                  f"{o_hit:>9.1f}%{o_top:>11}{n_hit:>9.1f}%{n_top:>11}")
    print("\n  %hit = share of flows predicted as the file's true app. Higher NEW is better.")


def main():
    banner("STEP 1-3  Extracting Instagram features")
    insta_files = sorted(
        os.path.join(INSTA_DIR, f) for f in os.listdir(INSTA_DIR)
        if f.lower().endswith((".pcap", ".pcapng"))
    ) if os.path.isdir(INSTA_DIR) else []
    insta_df = extract_app(insta_files, "INSTAGRAM")

    banner("STEP 1-3  Extracting YouTube features")
    yt_df = extract_app([YOUTUBE_FILE], "YOUTUBE")

    if insta_df.empty and yt_df.empty:
        sys.exit("No Instagram or YouTube flows extracted — aborting.")

    banner("STEP 4  Saving fresh CSVs")
    insta_df.to_csv(FRESH_INSTA_CSV, index=False)
    yt_df.to_csv(FRESH_YT_CSV, index=False)
    print(f"  Wrote {len(insta_df)} rows -> {FRESH_INSTA_CSV}")
    print(f"  Wrote {len(yt_df)} rows -> {FRESH_YT_CSV}")

    combined = build_combined(insta_df, yt_df)

    # Step 9 — back up the CURRENT model BEFORE retraining (becomes the baseline)
    banner("STEP 9  Backing up current model -> traffic_classifier_prev.pkl")
    if os.path.exists(MODEL_PATH):
        shutil.copy2(MODEL_PATH, BASELINE_PATH)
        print(f"  Backed up {MODEL_PATH}\n          -> {BASELINE_PATH}")
    else:
        print(f"  WARNING: {MODEL_PATH} missing — no baseline to back up.")

    model, X_test, y_test = train(combined)
    metrics = evaluate(model, X_test, y_test)
    saved = gate_and_save(model, metrics, len(combined) - len(X_test), len(X_test))
    spot_check(model)
    banner("DONE — " + ("model SAVED (review before committing)" if saved else "model NOT saved (gate failed)"))


if __name__ == "__main__":
    main()
