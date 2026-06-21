import os
from datetime import datetime, timedelta, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
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


def _user_from_token(authorization: Optional[str], db: Session) -> Optional[User]:
    """Decode a `Bearer <jwt>` Authorization header and return the User, or None
    if the header is missing/malformed/invalid/expired."""
    if not authorization or not authorization.lower().startswith("bearer "):
        return None
    token = authorization.split(" ", 1)[1].strip()
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload["sub"])
    except (JWTError, KeyError, ValueError):
        return None
    return db.query(User).filter(User.id == user_id).first()


def get_current_user(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> User:
    """Require a valid JWT. Raises 401 if absent or invalid."""
    user = _user_from_token(authorization, db)
    if user is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user


def get_current_user_optional(
    authorization: Optional[str] = Header(default=None),
    db: Session = Depends(get_db),
) -> Optional[User]:
    """Return the current user if a valid JWT is present, else None.
    Used by the classification endpoints so analyses are linked to a user when
    signed in, without forcing authentication on anonymous use."""
    return _user_from_token(authorization, db)


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
