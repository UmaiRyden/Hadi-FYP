"""
Augment the traffic classifier with fresh Facebook captures (v2 — gated).

Fixes vs v1:
  - Combine against ../filtered_dataset_train.csv (capped YouTube) instead of _final.
  - Cap facebook_audio4 flows to 3,000 via random sampling (random_state=42) so a
    single capture can't dominate the FACEBOOK class.
  - Train -> evaluate -> GATE on WhatsApp F1 >= 70% BEFORE saving. If the gate
    fails, the model is NOT saved and the original model is left on disk.
  - Fair before/after: the original model is evaluated on the SAME hold-out split.

Pipeline:
  1. Filter PCAPs starting with 'facebook_'.
  2. Extract the 18 features per flow (cap facebook_audio4 to 3,000).
  3. Label FACEBOOK.       4. Save backend/fresh_facebook_data.csv
  5. Combine with ../filtered_dataset_train.csv -> ../combined_dataset.csv
  6. Train RandomForest (class_weight='balanced', 80/20 stratified).
  7. Save model ONLY if WhatsApp F1 >= 70%.
  8. Accuracy, per-class F1, confusion matrix (+ before/after on same test set).
  9. Re-test old vs new on audio1a / chat_4a / video1a.

Usage:  python build_facebook_dataset.py [PCAP_DIR]
"""
import os
import shutil
import sys
import json

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
ROOT_DIR      = os.path.dirname(BASE_DIR)
PCAP_DIR      = sys.argv[1] if len(sys.argv) > 1 else r"D:\Downloads\NonVPN-PCAPs-01"
EXISTING_CSV  = os.path.join(ROOT_DIR, "filtered_dataset_train.csv")   # FIX 1: capped YouTube
FRESH_CSV     = os.path.join(BASE_DIR, "fresh_facebook_data.csv")
COMBINED_CSV  = os.path.join(ROOT_DIR, "combined_dataset.csv")
MODELS_DIR    = os.path.join(BASE_DIR, "models")
MODEL_PATH    = os.path.join(MODELS_DIR, "traffic_classifier_final.pkl")
BASELINE_PATH = os.path.join(MODELS_DIR, "traffic_classifier_prev.pkl")  # original production model
METRICS_PATH  = os.path.join(MODELS_DIR, "model_metrics.json")

CLASSES   = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"]
LABEL_COL = "ProtocolName"
PREFIX    = "facebook_"

# FIX 2: cap this capture; gate thresholds / goals
AUDIO4_KEY        = "facebook_audio4"
AUDIO4_CAP        = 3000
WHATSAPP_F1_GATE  = 70.0   # hard gate — below this, do NOT save
INSTAGRAM_F1_GOAL = 75.0   # reported goal
TEST_FILE_HINTS   = ["facebook_audio1a", "facebook_chat_4a", "facebook_video1a"]


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
def extract_facebook_flows():
    if not os.path.isdir(PCAP_DIR):
        sys.exit(f"PCAP directory not found: {PCAP_DIR}")
    files = sorted(
        f for f in os.listdir(PCAP_DIR)
        if f.lower().startswith(PREFIX) and f.lower().endswith((".pcap", ".pcapng"))
    )
    if not files:
        sys.exit(f"No files starting with '{PREFIX}' in {PCAP_DIR}")

    banner(f"STEP 1-3  Extracting features from {len(files)} facebook_ PCAP(s)")
    frames, per_file = [], {}
    for fname in files:
        path = os.path.join(PCAP_DIR, fname)
        try:
            flows, _ = parse_pcap(path)
            feats = extract_all_features(flows)
        except Exception as exc:
            print(f"  ! {fname:32} SKIPPED ({exc})")
            per_file[fname] = 0
            continue

        rows = []
        for f in feats:
            row = {n: f[n] for n in FEATURE_NAMES}
            row[LABEL_COL] = "FACEBOOK"
            row["source_file"] = fname
            rows.append(row)
        fdf = pd.DataFrame(rows, columns=FEATURE_NAMES + [LABEL_COL, "source_file"])
        raw_n = len(fdf)

        if AUDIO4_KEY in fname.lower() and raw_n > AUDIO4_CAP:
            fdf = fdf.sample(n=AUDIO4_CAP, random_state=42).reset_index(drop=True)
            print(f"  + {fname:32} {raw_n:6d} flows  ->  CAPPED to {AUDIO4_CAP} (random_state=42)")
        else:
            print(f"  + {fname:32} {raw_n:6d} flows")

        per_file[fname] = len(fdf)
        frames.append(fdf)

    fresh = pd.concat(frames, ignore_index=True)
    print(f"\n  Total Facebook flows after capping: {len(fresh)}")
    return fresh, per_file


# ── Step 4 ───────────────────────────────────────────────────────────────────
def save_fresh(fresh):
    banner("STEP 4  Saving fresh_facebook_data.csv")
    fresh.to_csv(FRESH_CSV, index=False)
    print(f"  Wrote {len(fresh)} rows -> {FRESH_CSV}")


# ── Step 5 ───────────────────────────────────────────────────────────────────
def build_combined(fresh):
    banner("STEP 5  Combining with filtered_dataset_train.csv (capped YouTube)")
    if not os.path.exists(EXISTING_CSV):
        sys.exit(f"Existing dataset not found: {EXISTING_CSV}")
    print(f"  Loading {EXISTING_CSV} ...")
    existing = pd.read_csv(EXISTING_CSV, usecols=FEATURE_NAMES + [LABEL_COL])
    print(f"  Existing rows: {len(existing):,}")

    combined = pd.concat([existing, fresh[FEATURE_NAMES + [LABEL_COL]]], ignore_index=True)
    combined.replace([np.inf, -np.inf], np.nan, inplace=True)
    before = len(combined)
    combined.dropna(subset=FEATURE_NAMES, inplace=True)
    combined.to_csv(COMBINED_CSV, index=False)

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

    # Fair before/after: original model on the SAME test set
    baseline_f1 = None
    if os.path.exists(BASELINE_PATH):
        base = joblib.load(BASELINE_PATH)
        baseline_f1 = _per_class_f1(y_test, base.predict(X_test))

    print("\n  Per-class F1  (before = original model on this same test set):")
    print(f"    {'class':12}{'BEFORE':>10}{'AFTER':>10}{'DELTA':>10}")
    for c in CLASSES:
        a = metrics["f1_per_class"][c]
        b = baseline_f1[c] if baseline_f1 else float("nan")
        d = f"{a - b:+.2f}" if baseline_f1 else "—"
        print(f"    {c:12}{b:>10.2f}{a:>10.2f}{d:>10}")

    print("\n  Confusion Matrix (rows=actual, cols=predicted):")
    print(f"{'':12}" + "".join(f"{c:>11}" for c in CLASSES))
    for label, row in zip(CLASSES, cm):
        print(f"{label:12}" + "".join(f"{v:>11,}" for v in row))
    return metrics


# ── Step 7 (gated) ───────────────────────────────────────────────────────────
def gate_and_save(model, metrics, n_train, n_test):
    banner("STEP 7  Gate check  (WhatsApp F1 >= 70%  to save)")
    wf1 = metrics["f1_per_class"]["WHATSAPP"]
    if1 = metrics["f1_per_class"]["INSTAGRAM"]
    print(f"  WhatsApp  F1 = {wf1}%   (gate {WHATSAPP_F1_GATE}%)   -> {'PASS' if wf1 >= WHATSAPP_F1_GATE else 'FAIL'}")
    print(f"  Instagram F1 = {if1}%   (goal {INSTAGRAM_F1_GOAL}%)  -> {'OK' if if1 >= INSTAGRAM_F1_GOAL else 'below goal'}")

    if wf1 < WHATSAPP_F1_GATE:
        print(f"\n  [FAIL] WhatsApp F1 {wf1}% < {WHATSAPP_F1_GATE}% -- MODEL NOT SAVED.")
        if os.path.exists(BASELINE_PATH):
            shutil.copy2(BASELINE_PATH, MODEL_PATH)
            print(f"  Restored original model -> {MODEL_PATH}")
        return False

    metrics["training_samples"] = n_train
    metrics["test_samples"] = n_test
    joblib.dump(model, MODEL_PATH)            # prev.pkl (original) is left untouched as the rollback point
    with open(METRICS_PATH, "w") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"\n  [OK] Saved new model -> {MODEL_PATH}")
    print(f"  Updated metrics      -> {METRICS_PATH}")
    return True


# ── Step 9 ───────────────────────────────────────────────────────────────────
def _fb_rate(model, X):
    if len(X) == 0:
        return 0.0, "—"
    preds = model.predict(X)
    vals, counts = np.unique(preds, return_counts=True)
    return float(np.mean(preds == "FACEBOOK")) * 100, vals[int(np.argmax(counts))]


def compare(new_model, per_file):
    banner("STEP 9  BEFORE (original) vs AFTER (new) on 3 Facebook PCAPs")
    if not os.path.exists(BASELINE_PATH):
        print("  No baseline model — skipping.")
        return
    old = joblib.load(BASELINE_PATH)
    chosen = [f for f in sorted(per_file) if per_file.get(f, 0) > 0
              and any(h in f.lower() for h in TEST_FILE_HINTS)]
    print(f"  {'file':26}{'flows':>7}{'OLD %FB':>10}{'OLD top':>11}{'NEW %FB':>10}{'NEW top':>11}")
    print("  " + "-" * 75)
    for fname in chosen:
        try:
            flows, _ = parse_pcap(os.path.join(PCAP_DIR, fname))
            X = _matrix_X(extract_all_features(flows))
        except Exception as exc:
            print(f"  {fname:26}  ERROR: {exc}")
            continue
        o_fb, o_top = _fb_rate(old, X)
        n_fb, n_top = _fb_rate(new_model, X)
        print(f"  {fname:26}{X.shape[0]:>7}{o_fb:>9.1f}%{o_top:>11}{n_fb:>9.1f}%{n_top:>11}")


def main():
    fresh, per_file = extract_facebook_flows()
    save_fresh(fresh)
    combined = build_combined(fresh)
    model, X_test, y_test = train(combined)
    metrics = evaluate(model, X_test, y_test)
    saved = gate_and_save(model, metrics, len(combined) - len(X_test), len(X_test))
    compare(model, per_file)          # compares in-memory new model regardless of save
    banner("DONE — " + ("model SAVED" if saved else "model NOT saved (gate failed)"))


if __name__ == "__main__":
    main()
