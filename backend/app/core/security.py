"""
Auth primitives: password hashing (stdlib PBKDF2, no extra native
dependencies) and JWT issuing/verification for the login-gated app.
"""
import hashlib
import hmac
import os
from datetime import datetime, timedelta

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import SessionLocal, get_db
from app.db.models import User

PBKDF2_ITERATIONS = 260_000
_bearer_scheme = HTTPBearer(auto_error=False)


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, hashed: str) -> bool:
    try:
        salt_hex, digest_hex = hashed.split("$", 1)
    except ValueError:
        return False
    salt = bytes.fromhex(salt_hex)
    expected = bytes.fromhex(digest_hex)
    actual = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PBKDF2_ITERATIONS)
    return hmac.compare_digest(actual, expected)


def create_access_token(user: User) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES)
    payload = {"sub": user.id, "username": user.username, "role": user.role, "exp": expire}
    return jwt.encode(payload, settings.JWT_SECRET, algorithm="HS256")


def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer_scheme),
    db: Session = Depends(get_db),
) -> User:
    unauthorized = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Not authenticated",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not credentials:
        raise unauthorized
    try:
        payload = jwt.decode(credentials.credentials, settings.JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise unauthorized

    user = db.query(User).filter_by(id=payload.get("sub")).first()
    if not user:
        raise unauthorized
    return user


def seed_admin_user():
    """Idempotently ensure the seeded admin account exists (called on startup)."""
    db = SessionLocal()
    try:
        if db.query(User).filter_by(username=settings.SEED_ADMIN_USERNAME).first():
            return
        admin = User(
            username=settings.SEED_ADMIN_USERNAME,
            password_hash=hash_password(settings.SEED_ADMIN_PASSWORD),
            role="admin",
        )
        db.add(admin)
        db.commit()
    finally:
        db.close()
