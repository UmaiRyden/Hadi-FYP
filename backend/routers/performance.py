import json
import os

from fastapi import APIRouter, HTTPException

from schemas.schemas import ConfusionMatrix, PerformanceMetrics

router = APIRouter(prefix="/api", tags=["performance"])

METRICS_PATH = os.path.join(
    os.path.dirname(__file__), "..", "models", "model_metrics.json"
)


@router.get("/performance", response_model=PerformanceMetrics)
def get_performance():
    path = os.path.abspath(METRICS_PATH)
    if not os.path.exists(path):
        raise HTTPException(
            status_code=503,
            detail="Model metrics not found. Run  python train_model.py  first.",
        )

    with open(path) as f:
        data = json.load(f)

    return PerformanceMetrics(
        accuracy=data["accuracy"],
        precision=data["precision"],
        recall=data["recall"],
        f1_score=data["f1_score"],
        confusion_matrix=ConfusionMatrix(
            labels=data["confusion_matrix"]["labels"],
            matrix=data["confusion_matrix"]["matrix"],
        ),
        training_samples=data["training_samples"],
        test_samples=data["test_samples"],
        feature_count=data["feature_count"],
        feature_names=data["feature_names"],
    )
