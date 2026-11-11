import datetime
import uuid
from functools import wraps

import jwt
from flask import g, request
from werkzeug.security import check_password_hash, generate_password_hash

from config import Config
from db import query
from utils import error


def hash_password(password):
    return generate_password_hash(password)  # salted, slow hash


def verify_password(password_hash, password):
    return check_password_hash(password_hash, password)


def create_token(doctor_id, remember=False):
    now = datetime.datetime.now(datetime.timezone.utc)
    lifetime = (
        datetime.timedelta(days=Config.JWT_REMEMBER_DAYS)
        if remember
        else datetime.timedelta(hours=Config.JWT_EXPIRE_HOURS)
    )
    payload = {
        "sub": str(doctor_id),
        "jti": str(uuid.uuid4()),
        "iat": now,
        "exp": now + lifetime,
    }
    return jwt.encode(payload, Config.JWT_SECRET, algorithm="HS256")


def token_required(fn):
    """Protects a route: validates the Bearer JWT, checks it has not been
    logged out, and puts the doctor's id in flask.g.doctor_id."""

    @wraps(fn)
    def wrapper(*args, **kwargs):
        header = request.headers.get("Authorization", "")
        if not header.startswith("Bearer "):
            return error("Authentication token is missing", 401)
        token = header[7:].strip()
        try:
            payload = jwt.decode(token, Config.JWT_SECRET, algorithms=["HS256"])
        except jwt.ExpiredSignatureError:
            return error("Session expired. Please log in again.", 401)
        except jwt.InvalidTokenError:
            return error("Invalid authentication token", 401)

        if query("SELECT 1 FROM token_blocklist WHERE jti=%s", (payload["jti"],), one=True):
            return error("You have been logged out. Please log in again.", 401)

        doctor = query("SELECT id FROM doctors WHERE id=%s", (payload["sub"],), one=True)
        if not doctor:
            return error("Account not found", 401)

        g.doctor_id = doctor["id"]
        g.token_payload = payload
        return fn(*args, **kwargs)

    return wrapper
