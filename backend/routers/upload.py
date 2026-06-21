import json
import math
import os
import time
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import SessionLocal, get_db
from models.db_models import AnalysisHistory, AnalysisJob, AnalysisResult, User
from routers.auth import get_current_user_optional
from schemas.schemas import ClassifyResponse, DeviceResult, FlowResult, PredictionItem, UploadResponse
from services.classifier import classify_flows_detailed, classify_by_device, classify_flows_running
from services.feature_extractor import extract_all_features
from services.pcap_parser import parse_pcap

router = APIRouter(prefix="/api", tags=["upload"])


def _match_strength(confidence: float) -> str:
    """Mirror the frontend bucketing: High >=75, Medium >=50, else Low."""
    if confidence >= 75:
        return "High"
    if confidence >= 50:
        return "Medium"
    return "Low"


def _save_history(
    db: Session,
    user_id: int,
    *,
    original_filename: str,
    predicted_app: str,
    confidence: float,
    flow_count: int,
    packet_count: int,
    vpn_detected: bool,
) -> None:
    """Persist a summary record of a completed analysis for the given user."""
    db.add(
        AnalysisHistory(
            user_id=user_id,
            original_filename=original_filename,
            predicted_app=predicted_app,
            confidence=confidence,
            match_strength=_match_strength(confidence),
            flow_count=flow_count,
            packet_count=packet_count,
            vpn_detected=bool(vpn_detected),
        )
    )
    db.commit()

UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "..", "uploads")
os.makedirs(UPLOADS_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pcap", ".pcapng"}


# ── Background processing task ────────────────────────────────────────────────

def _process(job_id: int, file_path: str) -> None:
    """Run in background: parse → extract → classify → persist result."""
    db = SessionLocal()
    start = time.time()

    try:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if not job:
            return

        # Stage 1 — parse
        job.status = "parsing"
        job.progress = 10
        db.commit()

        flows, total_packets = parse_pcap(file_path)

        # Stage 2 — extract features
        job.status = "extracting"
        job.progress = 40
        db.commit()

        features_list = extract_all_features(flows)

        if not features_list:
            job.status = "failed"
            job.error_message = "No valid IP/TCP/UDP flows found in the PCAP file."
            job.progress = 0
            db.commit()
            return

        # Stage 3 — classify, streaming running confidence to the DB so the
        # live view can show real progressive averages (not a fake animation).
        job.status = "classifying"
        job.progress = 75
        job.total_flows = len(features_list)
        job.processed_flows = 0
        job.partial_predictions_json = None
        db.commit()

        total = len(features_list)
        # Cap progressive updates at 30 batches. Pace each batch at >=0.25s and
        # stretch when there are few batches so the classify phase always lasts
        # >=4.5s regardless of flow count — giving the bars time to visibly grow.
        step = max(1, math.ceil(total / 30))
        n_updates = math.ceil(total / step)
        pace = max(0.25, 4.5 / n_updates)

        def _on_update(done: int, total_: int, preds: list) -> None:
            job.partial_predictions_json = json.dumps(preds)
            job.processed_flows = done
            job.progress = 75 + int(24 * done / total_)   # 75 -> 99 across classify
            db.commit()
            # Pace each batch so the client poll observes the averages grow.
            # The VALUES are the real running averages — only the cadence is paced.
            time.sleep(pace)

        classify_flows_running(features_list, _on_update, batch_size=step)

        # Detailed classification — same pipeline as the sync /api/classify
        # endpoint, so the async result carries full per-flow / per-device / VPN detail.
        classification = classify_flows_detailed(features_list)
        devices = classify_by_device(features_list)

        # Drop the heavy per-flow list from each device (mirrors DeviceResult schema)
        devices_clean = [
            {
                "source_ip":     d["source_ip"],
                "flow_count":    d["flow_count"],
                "predicted_app": d["predicted_app"],
                "confidence":    d["confidence"],
                "predictions":   d["predictions"],
            }
            for d in devices
        ]

        # Stage 4 — save result
        result = AnalysisResult(
            job_id=job_id,
            predicted_app=classification["predicted_app"],
            confidence=classification["confidence"],
            flow_count=classification["flow_count"],
            packet_count=total_packets,
            processing_time=round(time.time() - start, 2),
            predictions_json=json.dumps(classification["predictions"]),
            vpn_detected=classification["vpn_detected"],
            flows_json=json.dumps(classification["flows"]),
            devices_json=json.dumps(devices_clean),
        )
        db.add(result)

        job.status = "completed"
        job.progress = 100
        job.completed_at = datetime.now(timezone.utc)
        db.commit()

        # Save a per-user history record (only when the upload was authenticated).
        if job.user_id is not None:
            _save_history(
                db,
                job.user_id,
                original_filename=job.original_filename,
                predicted_app=classification["predicted_app"],
                confidence=classification["confidence"],
                flow_count=classification["flow_count"],
                packet_count=total_packets,
                vpn_detected=classification["vpn_detected"],
            )

    except Exception as exc:
        job = db.query(AnalysisJob).filter(AnalysisJob.id == job_id).first()
        if job:
            job.status = "failed"
            job.error_message = str(exc)
            job.progress = 0
            db.commit()
    finally:
        db.close()


# ── Route ─────────────────────────────────────────────────────────────────────

@router.post("/upload", response_model=UploadResponse)
async def upload_pcap(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .pcap and .pcapng files are accepted.",
        )

    # Persist file
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path = os.path.join(UPLOADS_DIR, unique_name)
    content = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    # Create job record (linked to the user when authenticated)
    job = AnalysisJob(
        filename=unique_name,
        original_filename=file.filename or unique_name,
        status="pending",
        progress=0,
        user_id=current_user.id if current_user else None,
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(_process, job.id, file_path)

    return UploadResponse(job_id=job.id, message="File uploaded. Analysis started.")


# ── Synchronous classify endpoint ─────────────────────────────────────────────

@router.post("/classify", response_model=ClassifyResponse)
async def classify_pcap(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User | None = Depends(get_current_user_optional),
):
    """
    Upload a PCAP file and receive the full classification result immediately.

    Runs the complete pipeline synchronously:
      pcap_parser → feature_extractor → classifier

    Returns the predicted application, confidence, aggregate probabilities,
    total flow/packet counts, and a per-flow breakdown.
    """
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail="Only .pcap and .pcapng files are accepted.",
        )

    # Save to a temp file so scapy can read it from disk
    unique_name = f"{uuid.uuid4()}{ext}"
    file_path   = os.path.join(UPLOADS_DIR, unique_name)
    content     = await file.read()
    with open(file_path, "wb") as f:
        f.write(content)

    start = time.time()

    try:
        # Stage 1 — parse
        flows, total_packets = parse_pcap(file_path)

        # Stage 2 — extract features
        features_list = extract_all_features(flows)

        if not features_list:
            raise HTTPException(
                status_code=422,
                detail="No valid IP/TCP/UDP flows found in the PCAP file.",
            )

        # Stage 3 — classify (overall + per-device)
        result  = classify_flows_detailed(features_list)
        devices = classify_by_device(features_list)

    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Analysis failed: {exc}")
    finally:
        try:
            os.remove(file_path)
        except OSError:
            pass

    processing_time = round(time.time() - start, 2)

    # Save a per-user history record (only when authenticated).
    if current_user is not None:
        _save_history(
            db,
            current_user.id,
            original_filename=file.filename or unique_name,
            predicted_app=result["predicted_app"],
            confidence=result["confidence"],
            flow_count=result["flow_count"],
            packet_count=total_packets,
            vpn_detected=result["vpn_detected"],
        )

    return ClassifyResponse(
        predicted_app   = result["predicted_app"],
        confidence      = result["confidence"],
        flow_count      = result["flow_count"],
        packet_count    = total_packets,
        processing_time = processing_time,
        vpn_detected    = result["vpn_detected"],
        predictions     = [PredictionItem(**p) for p in result["predictions"]],
        flows           = [
            FlowResult(
                flow_key      = f["flow_key"],
                predicted_app = f["predicted_app"],
                confidence    = f["confidence"],
                vpn_detected  = f["vpn_detected"],
                features      = f["features"],
            )
            for f in result["flows"]
        ],
        devices         = [
            DeviceResult(
                source_ip     = d["source_ip"],
                flow_count    = d["flow_count"],
                predicted_app = d["predicted_app"],
                confidence    = d["confidence"],
                predictions   = [PredictionItem(**p) for p in d["predictions"]],
            )
            for d in devices
        ],
    )
