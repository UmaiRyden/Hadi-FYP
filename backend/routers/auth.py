import os
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from database import get_db
from models.db_models import User
from schemas.schemas import Token, UserCreate, UserLogin, UserResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

SECRET_KEY = os.getenv("SECRET_KEY", "change-this-in-production")
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def _truncate(password: str) -> bytes:
    # bcrypt only considers the first 72 bytes and raises on longer input;
    # truncate to stay within the limit. Encode first so the cap is on bytes,
    # not characters (multi-byte chars count for more than one byte).
    return password.encode("utf-8")[:72]


def _hash(password: str) -> str:
    return pwd_context.hash(_truncate(password))


def _verify(plain: str, hashed: str) -> bool:
    return pwd_context.verify(_truncate(plain), hashed)


def _make_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


@router.post("/signup", response_model=Token)
def signup(data: UserCreate, db: Session = Depends(get_db)):
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=data.email,
        full_name=data.full_name,
        hashed_password=_hash(data.password),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return Token(
        access_token=_make_token(user.id),
        user=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=Token)
def login(data: UserLogin, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == data.email).first()
    if not user or not _verify(data.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    return Token(
        access_token=_make_token(user.id),
        user=UserResponse.model_validate(user),
    )
