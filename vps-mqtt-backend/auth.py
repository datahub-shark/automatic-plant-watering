"""
Xác thực JWT và băm mật khẩu PBKDF2-SHA256 không phụ thuộc thư viện C++ bên ngoài.
"""

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Annotated, Optional

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from pydantic import BaseModel
from sqlalchemy.orm import Session

from db import User, get_db

ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "720"))

# Đọc khóa bí mật từ biến môi trường; nếu chưa cấu hình, dùng khóa ngẫu nhiên theo phiên chạy
_EPHEMERAL_SECRET = secrets.token_hex(32)


def get_jwt_secret() -> str:
    env_secret = os.getenv("JWT_SECRET", "").strip()
    if env_secret and not env_secret.startswith("CHANGE_ME"):
        return env_secret
    return _EPHEMERAL_SECRET


oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login", auto_error=False)


class Token(BaseModel):
    access_token: str
    token_type: str
    username: Optional[str] = None
    role: Optional[str] = None


def get_password_hash(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
    return f"pbkdf2${salt.hex()}${dk.hex()}"


def verify_password(plain_password: str, stored_hash: str) -> bool:
    try:
        scheme, salt_hex, hash_hex = stored_hash.split("$")
        if scheme != "pbkdf2":
            return False
        salt = bytes.fromhex(salt_hex)
        expected = bytes.fromhex(hash_hex)
        actual = hashlib.pbkdf2_hmac("sha256", plain_password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(actual, expected)
    except Exception:
        return False


def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, get_jwt_secret(), algorithm=ALGORITHM)


def authenticate_user(db: Session, email: str, password: str) -> Optional[User]:
    user = db.query(User).filter(User.email == email).first()
    if not user:
        return None
    if not verify_password(password, user.password_hash):
        return None
    return user


def get_current_user(
    token: Annotated[Optional[str], Depends(oauth2_scheme)],
    db: Session = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Không thể xác thực thông tin đăng nhập",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if not token:
        raise credentials_exception

    try:
        payload = jwt.decode(token, get_jwt_secret(), algorithms=[ALGORITHM])
        user_id: Optional[str] = payload.get("sub")
        if not user_id:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception

    user = db.get(User, user_id)
    if user is None:
        raise credentials_exception
    return user


def get_current_active_user(
    current_user: Annotated[User, Depends(get_current_user)],
) -> User:
    return current_user
