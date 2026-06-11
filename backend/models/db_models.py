from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime, timezone

from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    full_name = Column(String, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    jobs = relationship("AnalysisJob", back_populates="user")


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    filename = Column(String, nullable=False)            # saved name on disk (UUID)
    original_filename = Column(String, nullable=False)   # original uploaded name
    status = Column(String, default="pending")           # pending | parsing | extracting | classifying | completed | failed
    progress = Column(Integer, default=0)                # 0-100
    error_message = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
    completed_at = Column(DateTime, nullable=True)
    # Running classification state — updated every N flows during the classify
    # stage so the live view shows real progressive confidence (not a fake
    # animation). Nullable so they can be added to existing rows by migration.
    total_flows = Column(Integer, nullable=True)               # flows to classify
    processed_flows = Column(Integer, nullable=True)           # flows classified so far
    partial_predictions_json = Column(Text, nullable=True)     # running [{"app","confidence"}]

    user = relationship("User", back_populates="jobs")
    result = relationship("AnalysisResult", back_populates="job", uselist=False)


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("analysis_jobs.id"), unique=True)
    predicted_app = Column(String, nullable=False)
    confidence = Column(Float, nullable=False)
    flow_count = Column(Integer, nullable=False)
    packet_count = Column(Integer, nullable=False)
    processing_time = Column(Float, nullable=False)   # seconds
    predictions_json = Column(Text, nullable=False)   # JSON: [{"app": ..., "confidence": ...}]
    # Full per-flow / per-device / VPN detail — added so the async pipeline returns
    # the same complete result as the sync /api/classify endpoint. Nullable so the
    # column can be added to existing rows without a backfill default.
    vpn_detected = Column(Boolean, nullable=True)     # True if majority of flows are VPN
    flows_json = Column(Text, nullable=True)          # JSON: [FlowResult, ...]
    devices_json = Column(Text, nullable=True)        # JSON: [DeviceResult, ...]

    job = relationship("AnalysisJob", back_populates="result")
