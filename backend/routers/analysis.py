import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import AnalysisJob
from schemas.schemas import AnalysisResult, PredictionItem

router = APIRouter(prefix="/api", tags=["analysis"])


@router.get("/result/{job_id}", response_model=AnalysisResult)
def get_result(job_id: int, db: Session = Depends(get_db)):
    job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    response = AnalysisResult(
        job_id=job.id,
        status=job.status,
        progress=job.progress,
        original_filename=job.original_filename,
        error_message=job.error_message,
    )

    if job.result:
        r = job.result
        response.predicted_app = r.predicted_app
        response.confidence = r.confidence
        response.flow_count = r.flow_count
        response.packet_count = r.packet_count
        response.processing_time = r.processing_time
        response.predictions = [
            PredictionItem(**p) for p in json.loads(r.predictions_json)
        ]

    return response
