from typing import List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import AnalysisHistory, User
from routers.auth import get_current_user
from schemas.schemas import HistoryItem

router = APIRouter(prefix="/api", tags=["history"])


@router.get("/history", response_model=List[HistoryItem])
def list_history(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return the authenticated user's 10 most recent analyses (newest first)."""
    return (
        db.query(AnalysisHistory)
        .filter(AnalysisHistory.user_id == current_user.id)
        .order_by(AnalysisHistory.created_at.desc(), AnalysisHistory.id.desc())
        .limit(10)
        .all()
    )


@router.get("/history/{history_id}", response_model=HistoryItem)
def get_history_item(
    history_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Return a single saved analysis for re-viewing — scoped to the owner."""
    row = (
        db.query(AnalysisHistory)
        .filter(
            AnalysisHistory.id == history_id,
            AnalysisHistory.user_id == current_user.id,
        )
        .first()
    )
    if row is None:
        raise HTTPException(status_code=404, detail="History record not found")
    return row
