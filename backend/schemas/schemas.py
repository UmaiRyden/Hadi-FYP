from pydantic import BaseModel, EmailStr
from typing import List, Optional
from datetime import datetime


# ── Auth ──────────────────────────────────────────────────────────────────────

class UserCreate(BaseModel):
    full_name: str
    email: EmailStr
    password: str


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: int
    email: str
    full_name: str
    created_at: datetime

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# ── Upload ────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    job_id: int
    message: str


# ── Analysis Result ───────────────────────────────────────────────────────────

class PredictionItem(BaseModel):
    app: str
    confidence: float


class FlowResult(BaseModel):
    flow_key: str
    predicted_app: str
    confidence: float
    vpn_detected: bool
    features: dict


class DeviceResult(BaseModel):
    source_ip: str
    flow_count: int
    predicted_app: str
    confidence: float
    predictions: List[PredictionItem]


class AnalysisResult(BaseModel):
    job_id: int
    status: str
    progress: int
    original_filename: Optional[str] = None
    predicted_app: Optional[str] = None
    confidence: Optional[float] = None
    flow_count: Optional[int] = None
    packet_count: Optional[int] = None
    processing_time: Optional[float] = None
    predictions: Optional[List[PredictionItem]] = None
    vpn_detected: Optional[bool] = None
    flows: Optional[List[FlowResult]] = None
    devices: Optional[List[DeviceResult]] = None
    error_message: Optional[str] = None


# ── Classify (synchronous, per-flow) ─────────────────────────────────────────

class ClassifyResponse(BaseModel):
    predicted_app: str
    confidence: float
    flow_count: int
    packet_count: int
    processing_time: float
    vpn_detected: bool                     # True if majority of flows are VPN
    predictions: List[PredictionItem]      # aggregate probabilities across all flows
    flows: List[FlowResult]                # per-flow breakdown
    devices: List[DeviceResult]            # per-device breakdown


# ── Performance Metrics ───────────────────────────────────────────────────────

class ConfusionMatrix(BaseModel):
    labels: List[str]
    matrix: List[List[int]]


class PerformanceMetrics(BaseModel):
    accuracy: float
    precision: float
    recall: float
    f1_score: float
    confusion_matrix: ConfusionMatrix
    training_samples: int
    test_samples: int
    feature_count: int
    feature_names: List[str]
