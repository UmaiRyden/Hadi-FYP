"""
Classifier — loads the trained RandomForest model and classifies
a list of extracted flow-feature dicts into FACEBOOK / INSTAGRAM / WHATSAPP / YOUTUBE.
"""
import os
from collections import defaultdict
from typing import Dict, List

import joblib
import numpy as np

MODEL_PATH     = os.path.join(os.path.dirname(__file__), "..", "models", "traffic_classifier_final.pkl")
VPN_MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "models", "vpn_classifier.pkl")

# Must match the exact order used in train_model.py
FEATURE_ORDER = [
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

# 6 features shared with vpn_classifier.pkl (ARFF names → our pipeline names)
VPN_FEATURE_ORDER = [
    "Flow.Duration",
    "Bwd.IAT.Mean",
    "Bwd.IAT.Std",
    "Bwd.IAT.Max",
    "Flow.Packets.s",
    "Flow.Bytes.s",
]

_model     = None
_vpn_model = None


def load_model():
    global _model
    if _model is None:
        path = os.path.abspath(MODEL_PATH)
        if not os.path.exists(path):
            raise FileNotFoundError(
                f"ML model not found at {path}. "
                "Run  python train_model.py  from the backend directory first."
            )
        _model = joblib.load(path)
    return _model


def load_vpn_model():
    global _vpn_model
    if _vpn_model is None:
        path = os.path.abspath(VPN_MODEL_PATH)
        if not os.path.exists(path):
            raise FileNotFoundError(f"VPN model not found at {path}.")
        _vpn_model = joblib.load(path)
    return _vpn_model


def _run_vpn_detection(features_list: List[Dict]) -> List[bool]:
    """
    Run the VPN binary classifier on each flow.
    Returns a list of booleans (True = VPN detected).
    Falls back to all-False if the model file is missing.
    """
    try:
        vpn_model = load_vpn_model()
        X_vpn = np.array(
            [[f.get(feat, 0.0) for feat in VPN_FEATURE_ORDER] for f in features_list]
        )
        # Model was trained with 1=VPN, 0=Non-VPN
        preds = vpn_model.predict(X_vpn)
        return [bool(p == 1) for p in preds]
    except FileNotFoundError:
        return [False] * len(features_list)


def classify_flows(features_list: List[Dict]) -> Dict:
    """
    Classify all flows and return an aggregated prediction.

    Returns:
        {
            "predicted_app": str,
            "confidence":    float (0–100),
            "predictions":   [{"app": str, "confidence": float}, ...],  # sorted desc
            "flow_count":    int,
        }
    """
    if not features_list:
        return {
            "predicted_app": "Unknown",
            "confidence": 0.0,
            "predictions": [],
            "flow_count": 0,
        }

    model = load_model()

    # Build feature matrix in the exact column order the model was trained on
    X = np.array(
        [[f.get(feat, 0.0) for feat in FEATURE_ORDER] for f in features_list]
    )

    # Average probability across all flows → one aggregate prediction
    proba     = model.predict_proba(X)      # (n_flows, n_classes)
    avg_proba = np.mean(proba, axis=0)      # (n_classes,)

    predictions = [
        {"app": cls, "confidence": round(float(p) * 100, 1)}
        for cls, p in zip(model.classes_, avg_proba)
    ]
    predictions.sort(key=lambda x: x["confidence"], reverse=True)

    top = predictions[0]
    return {
        "predicted_app": top["app"],
        "confidence":    top["confidence"],
        "predictions":   predictions,
        "flow_count":    len(features_list),
    }


def classify_flows_running(features_list: List[Dict], on_update, batch_size: int = 10) -> None:
    """
    Classify every flow once, but invoke on_update(processed, total, predictions)
    after every `batch_size` flows with the running confidence distribution —
    the cumulative average of predict_proba over the flows seen so far.

    `predictions` is the sorted aggregate [{"app", "confidence"}] across the
    flows processed so far (same shape as classify_flows). This lets the caller
    stream genuine partial results to the DB instead of faking a progress bar.
    """
    if not features_list:
        return

    model = load_model()
    X = np.array(
        [[f.get(feat, 0.0) for feat in FEATURE_ORDER] for f in features_list]
    )
    proba = model.predict_proba(X)          # (n_flows, n_classes)
    classes = model.classes_
    total = len(features_list)
    running_sum = np.zeros(len(classes))

    for i in range(total):
        running_sum += proba[i]
        done = i + 1
        if done % batch_size == 0 or done == total:
            avg = running_sum / done
            preds = sorted(
                ({"app": c, "confidence": round(float(p) * 100, 1)} for c, p in zip(classes, avg)),
                key=lambda x: x["confidence"],
                reverse=True,
            )
            on_update(done, total, preds)


def classify_flows_detailed(features_list: List[Dict]) -> Dict:
    """
    Like classify_flows, but also returns a per-flow breakdown.

    Each entry in "flows" contains the flow's individual predicted label,
    confidence, and the feature values used for that prediction.

    Returns:
        {
            "predicted_app": str,
            "confidence":    float,
            "predictions":   [...],
            "flow_count":    int,
            "flows": [
                {
                    "flow_key":      str,
                    "predicted_app": str,
                    "confidence":    float,
                    "features":      dict,
                },
                ...
            ]
        }
    """
    if not features_list:
        return {
            "predicted_app": "Unknown",
            "confidence":    0.0,
            "predictions":   [],
            "flow_count":    0,
            "vpn_detected":  False,
            "flows":         [],
        }

    model = load_model()

    X = np.array(
        [[f.get(feat, 0.0) for feat in FEATURE_ORDER] for f in features_list]
    )

    proba     = model.predict_proba(X)   # (n_flows, n_classes)
    avg_proba = np.mean(proba, axis=0)

    # Aggregate result
    agg_predictions = [
        {"app": cls, "confidence": round(float(p) * 100, 1)}
        for cls, p in zip(model.classes_, avg_proba)
    ]
    agg_predictions.sort(key=lambda x: x["confidence"], reverse=True)
    top = agg_predictions[0]

    # VPN detection (per-flow)
    vpn_flags = _run_vpn_detection(features_list)
    vpn_detected_overall = sum(vpn_flags) > len(vpn_flags) / 2

    # Per-flow results
    flow_results = []
    for i, f in enumerate(features_list):
        flow_proba  = proba[i]
        best_idx    = int(np.argmax(flow_proba))
        flow_results.append({
            "flow_key":      f.get("flow_key", str(i)),
            "predicted_app": model.classes_[best_idx],
            "confidence":    round(float(flow_proba[best_idx]) * 100, 1),
            "vpn_detected":  vpn_flags[i],
            "features":      {k: v for k, v in f.items() if k not in ("flow_key", "source_ip")},
        })

    return {
        "predicted_app":  top["app"],
        "confidence":     top["confidence"],
        "predictions":    agg_predictions,
        "flow_count":     len(features_list),
        "vpn_detected":   vpn_detected_overall,
        "flows":          flow_results,
    }


def classify_by_device(features_list: List[Dict]) -> List[Dict]:
    """
    Group flows by source IP and run classify_flows_detailed independently
    for each device (unique Source.IP).

    Returns a list sorted by flow_count descending:
        [
            {
                "source_ip":     str,
                "flow_count":    int,
                "predicted_app": str,
                "confidence":    float,
                "predictions":   [...],
                "flows":         [...],
            },
            ...
        ]
    """
    grouped: Dict[str, List[Dict]] = defaultdict(list)
    for f in features_list:
        ip = str(f.get("source_ip", "unknown"))
        grouped[ip].append(f)

    devices = []
    for source_ip, device_flows in grouped.items():
        result = classify_flows_detailed(device_flows)
        devices.append({
            "source_ip":     source_ip,
            "flow_count":    result["flow_count"],
            "predicted_app": result["predicted_app"],
            "confidence":    result["confidence"],
            "predictions":   result["predictions"],
            "flows":         result["flows"],
        })

    devices.sort(key=lambda d: d["flow_count"], reverse=True)
    return devices
