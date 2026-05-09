from sqlalchemy import Column, Integer, String, Float, DateTime, Text, ForeignKey
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

    job = relationship("AnalysisJob", back_populates="result")
