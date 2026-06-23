"""
Retrain the traffic classifier with fresh WhatsApp flows (same method as before).

Pipeline:
  1. Base dataset = combined_dataset.csv (already contains filtered_dataset_train.csv
     + fresh Facebook + fresh Instagram + fresh YouTube).
  2. Add fresh_whatsapp_data.csv (97 flows, <= 3000 cap so no extra capping).
  3. Back up CURRENT model -> traffic_classifier_prev.pkl FIRST.
  4. Retrain RandomForest (n_estimators=200, max_depth=15, class_weight='balanced',
     80/20 stratified, random_state=42).
  5. Evaluate on the 20% hold-out: accuracy/precision/recall/F1, per-class F1
     BEFORE (prev.pkl) vs AFTER on the same test split, confusion matrix.
  6. Save new model -> traffic_classifier_final.pkl + model_metrics.json.
  7. Spot check: BEFORE vs AFTER on the 4 fresh WhatsApp PCAPs.

Usage:  python retrain_with_whatsapp.py
"""
import os
import sys
import json
import shutil

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

ROOT_DIR        = os.path.dirname(BASE_DIR)
COMBINED_CSV    = os.path.join(ROOT_DIR, "combined_dataset.csv")
FRESH_WA_CSV    = os.path.join(BASE_DIR, "fresh_whatsapp_data.csv")
WHATSAPP_DIR    = os.path.join(BASE_DIR, "fresh_data", "whatsapp")
MODELS_DIR      = os.path.join(BASE_DIR, "models")
MODEL_PATH      = os.path.join(MODELS_DIR, "traffic_classifier_final.pkl")
BASELINE_PATH   = os.path.join(MODELS_DIR, "traffic_classifier_prev.pkl")
METRICS_PATH    = os.path.join(MODELS_DIR, "model_metrics.json")
COMBINED_BACKUP = os.path.join(ROOT_DIR, "combined_dataset_prev.csv")

CLASSES   = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"]
LABEL_COL = "ProtocolName"
WHATSAPP_F1_GATE = 70.0


def banner(title):
    print("\n" + "=" * 72)
    print(title)
    print("=" * 72)


def _matrix_X(feats):
    X = np.array([[f[n] for n in FEATURE_NAMES] for f in feats], dtype=float)
    if X.size:
        X[~np.isfinite(X)] = 0.0
    return X


def _per_class_f1(y_true, y_pred):
    return {c: round(v * 100, 2)
            for c, v in zip(CLASSES,
                            f1_score(y_true, y_pred, labels=CLASSES, average=None, zero_division=0))}


def build_combined():
    banner("STEP 1-2  Building combined dataset (combined_dataset.csv + fresh WhatsApp)")
    base = pd.read_csv(COMBINED_CSV, usecols=FEATURE_NAMES + [LABEL_COL])
    wa = pd.read_csv(FRESH_WA_CSV, usecols=FEATURE_NAMES + [LABEL_COL])
    print(f"  base combined_dataset.csv : {len(base):>7,} rows")
    print(f"  fresh WhatsApp            : {len(wa):>7,} rows")

    combined = pd.concat([base, wa], ignore_index=True)
    combined.replace([np.inf, -np.inf], np.nan, inplace=True)
    before = len(combined)
    combined.dropna(subset=FEATURE_NAMES, inplace=True)
    print(f"  combined                  : {len(combined):>7,} rows (dropped {before - len(combined)} NaN/inf)")
    print("\n  Class distribution:")
    for cls, n in combined[LABEL_COL].value_counts().items():
        print(f"    {cls:12} {n:,}")

    # Persist new combined; keep a backup of the previous one.
    if os.path.exists(COMBINED_CSV):
        shutil.copy2(COMBINED_CSV, COMBINED_BACKUP)
    combined.to_csv(COMBINED_CSV, index=False)
    print(f"\n  Backed up previous combined -> {COMBINED_BACKUP}")
    print(f"  Wrote new combined          -> {COMBINED_CSV}")
    return combined


def train(combined):
    banner("STEP 4  Training RandomForest (class_weight='balanced', 80/20 stratified)")
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


def evaluate(model, X_test, y_test):
    banner("STEP 5  Evaluation on the 20% hold-out test set")
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

    print("\n  Per-class F1  (BEFORE = prev.pkl on same test set, AFTER = new model):")
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


def save_model(model, metrics, n_train, n_test):
    banner("STEP 6  Saving new model")
    wf1 = metrics["f1_per_class"]["WHATSAPP"]
    status = "PASS" if wf1 >= WHATSAPP_F1_GATE else "BELOW GATE"
    print(f"  WhatsApp F1 = {wf1}%  (informational gate {WHATSAPP_F1_GATE}%) -> {status}")
    metrics["training_samples"] = n_train
    metrics["test_samples"] = n_test
    joblib.dump(model, MODEL_PATH)
    with open(METRICS_PATH, "w") as fh:
        json.dump(metrics, fh, indent=2)
    print(f"  Saved new model -> {MODEL_PATH}")
    print(f"  Updated metrics -> {METRICS_PATH}")
    print(f"  (Previous model preserved at {BASELINE_PATH})")


def _rate(model, X, label):
    if len(X) == 0:
        return 0.0, "-"
    preds = model.predict(X)
    vals, counts = np.unique(preds, return_counts=True)
    return float(np.mean(preds == label)) * 100, vals[int(np.argmax(counts))]


def spot_check(new_model):
    banner("STEP 7  BEFORE (prev.pkl) vs AFTER (new) on the 4 fresh WhatsApp PCAPs")
    if not os.path.exists(BASELINE_PATH):
        print("  No baseline — skipping.")
        return
    old = joblib.load(BASELINE_PATH)
    files = sorted(
        os.path.join(WHATSAPP_DIR, f) for f in os.listdir(WHATSAPP_DIR)
        if f.lower().endswith((".pcap", ".pcapng"))
    )
    print(f"  {'file':24}{'flows':>7}{'OLD %WA':>10}{'OLD top':>11}{'NEW %WA':>10}{'NEW top':>11}")
    print("  " + "-" * 73)
    for path in files:
        try:
            flows, _ = parse_pcap(path)
            X = _matrix_X(extract_all_features(flows))
        except Exception as exc:
            print(f"  {os.path.basename(path):24}  ERROR: {exc}")
            continue
        o_hit, o_top = _rate(old, X, "WHATSAPP")
        n_hit, n_top = _rate(new_model, X, "WHATSAPP")
        print(f"  {os.path.basename(path):24}{X.shape[0]:>7}"
              f"{o_hit:>9.1f}%{o_top:>11}{n_hit:>9.1f}%{n_top:>11}")
    print("\n  %WA = share of flows predicted WHATSAPP. 'top' = majority-vote app for the file.")
    print("  Higher NEW %WA and NEW top = WHATSAPP means the fix worked.")


def main():
    combined = build_combined()

    banner("STEP 3  Backing up current model -> traffic_classifier_prev.pkl")
    if os.path.exists(MODEL_PATH):
        shutil.copy2(MODEL_PATH, BASELINE_PATH)
        print(f"  Backed up {MODEL_PATH}\n          -> {BASELINE_PATH}")
    else:
        print(f"  WARNING: {MODEL_PATH} missing — no baseline to back up.")

    model, X_test, y_test = train(combined)
    metrics = evaluate(model, X_test, y_test)
    save_model(model, metrics, len(combined) - len(X_test), len(X_test))
    spot_check(model)
    banner("DONE — new model saved. Previous model retained as traffic_classifier_prev.pkl.")


if __name__ == "__main__":
    main()
