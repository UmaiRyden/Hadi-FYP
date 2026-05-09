"""
Train and save the RandomForest model for encrypted traffic classification.

Dataset: filtered_dataset_clean.csv (Facebook, Instagram, WhatsApp flows)
         Place it in the project root (one level above this file).

Run once before starting the server:
    python train_model.py

Generates:
    models/ml_model.pkl         — trained scikit-learn model
    models/model_metrics.json   — accuracy, precision, recall, F1, confusion matrix
"""
import os
import json

import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
)

MODELS_DIR   = os.path.join(os.path.dirname(__file__), "models")
MODEL_PATH   = os.path.join(MODELS_DIR, "traffic_classifier_final.pkl")
METRICS_PATH = os.path.join(MODELS_DIR, "model_metrics.json")

# Dataset is one directory above backend/
DATASET_PATH = os.path.join(os.path.dirname(__file__), "..", "filtered_dataset_train.csv")

FEATURES = [
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

CLASSES = ["FACEBOOK", "INSTAGRAM", "WHATSAPP", "YOUTUBE"]

os.makedirs(MODELS_DIR, exist_ok=True)


def main():
    print(f"Loading dataset from {DATASET_PATH} ...")
    df = pd.read_csv(DATASET_PATH, usecols=FEATURES + ["ProtocolName"])

    X = df[FEATURES].values
    y = df["ProtocolName"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"Training on {len(X_train)} samples, testing on {len(X_test)} samples...")

    model = RandomForestClassifier(
        n_estimators=200,
        max_depth=15,
        random_state=42,
        n_jobs=-1,
        class_weight="balanced",
    )
    model.fit(X_train, y_train)

    y_pred = model.predict(X_test)

    cm = confusion_matrix(y_test, y_pred, labels=CLASSES)
    f1_per_class = f1_score(y_test, y_pred, labels=CLASSES, average=None)

    metrics = {
        "accuracy":  round(accuracy_score(y_test, y_pred) * 100, 2),
        "precision": round(precision_score(y_test, y_pred, average="weighted") * 100, 2),
        "recall":    round(recall_score(y_test, y_pred,    average="weighted") * 100, 2),
        "f1_score":  round(f1_score(y_test, y_pred,        average="weighted") * 100, 2),
        "f1_per_class": {c: round(v * 100, 2) for c, v in zip(CLASSES, f1_per_class)},
        "confusion_matrix": {
            "labels": CLASSES,
            "matrix": cm.tolist(),
        },
        "training_samples": len(X_train),
        "test_samples":     len(X_test),
        "feature_count":    len(FEATURES),
        "feature_names":    FEATURES,
    }

    joblib.dump(model, MODEL_PATH)
    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    print(f"\nModel   → {MODEL_PATH}")
    print(f"Metrics → {METRICS_PATH}")
    print(f"\nAccuracy : {metrics['accuracy']}%")
    print(f"Precision: {metrics['precision']}%")
    print(f"Recall   : {metrics['recall']}%")
    print(f"F1-Score : {metrics['f1_score']}%")
    print("\nF1 per class:")
    for cls, val in metrics["f1_per_class"].items():
        print(f"  {cls:12} {val}%")
    print("\nConfusion Matrix (rows=actual, cols=predicted):")
    print(f"{'':12}" + "  ".join(f"{c:10}" for c in CLASSES))
    for label, row in zip(CLASSES, cm):
        print(f"{label:12}" + "  ".join(f"{v:10}" for v in row))


if __name__ == "__main__":
    main()
