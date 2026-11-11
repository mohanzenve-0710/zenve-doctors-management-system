import datetime
import hashlib
import secrets

from flask import Blueprint, g, jsonify, request

from auth_utils import (create_token, hash_password, token_required,
                        verify_password)
from config import Config
from db import execute, query
from utils import (clean, error, is_valid_email, password_problem, send_email)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

PUBLIC_FIELDS = (
    "id, full_name, email, phone, qualification, specialization, "
    "experience_years, clinic_name, clinic_address, address, profile_image, "
    "last_login, created_at"
)


@auth_bp.post("/register")
def register():
    data = request.get_json(silent=True) or {}
    full_name = clean(data.get("full_name"))
    email = (clean(data.get("email")) or "").lower()
    password = data.get("password") or ""
    phone = clean(data.get("phone"))
    specialization = clean(data.get("specialization"))

    if not full_name:
        return error("Full name is required")
    if not is_valid_email(email):
        return error("Enter a valid email address")
    problem = password_problem(password)
    if problem:
        return error(problem)
    if not phone or not phone.replace("+", "").replace(" ", "").replace("-", "").isdigit() \
            or len(phone) < 10:
        return error("Enter a valid phone number (at least 10 digits)")

    if query("SELECT id FROM doctors WHERE email=%s", (email,), one=True):
        return error("An account with this email already exists", 409)

    doctor_id, _ = execute(
        "INSERT INTO doctors (full_name, email, password_hash, phone, specialization) "
        "VALUES (%s, %s, %s, %s, %s)",
        (full_name, email, hash_password(password), phone, specialization),
    )
    return jsonify({"message": "Account created. You can now log in.", "id": doctor_id}), 201


@auth_bp.post("/login")
def login():
    data = request.get_json(silent=True) or {}
    email = (clean(data.get("email")) or "").lower()
    password = data.get("password") or ""
    remember = bool(data.get("remember"))

    if not is_valid_email(email) or not password:
        return error("Email and password are required")

    doctor = query("SELECT * FROM doctors WHERE email=%s", (email,), one=True)
    if not doctor or not verify_password(doctor["password_hash"], password):
        return error("Invalid email or password", 401)

    execute("UPDATE doctors SET last_login=NOW() WHERE id=%s", (doctor["id"],))
    token = create_token(doctor["id"], remember)
    doctor.pop("password_hash", None)
    return jsonify({"token": token, "doctor": doctor})


@auth_bp.post("/logout")
@token_required
def logout():
    payload = g.token_payload
    expires = datetime.datetime.fromtimestamp(payload["exp"], datetime.timezone.utc).replace(tzinfo=None)
    execute("INSERT IGNORE INTO token_blocklist (jti, expires_at) VALUES (%s, %s)",
            (payload["jti"], expires))
    # housekeeping: forget tokens that have expired anyway
    execute("DELETE FROM token_blocklist WHERE expires_at < UTC_TIMESTAMP()")
    return jsonify({"message": "Logged out successfully"})


@auth_bp.get("/me")
@auth_bp.get("/validate-token")
@token_required
def me():
    doctor = query(f"SELECT {PUBLIC_FIELDS} FROM doctors WHERE id=%s", (g.doctor_id,), one=True)
    return jsonify({"valid": True, "doctor": doctor})


@auth_bp.post("/forgot-password")
def forgot_password():
    data = request.get_json(silent=True) or {}
    email = (clean(data.get("email")) or "").lower()
    if not is_valid_email(email):
        return error("Enter a valid email address")

    generic = {"message": "If an account exists for that email, a reset link has been sent."}
    doctor = query("SELECT id, full_name FROM doctors WHERE email=%s", (email,), one=True)
    if not doctor:
        return jsonify(generic)  # do not reveal whether the email exists

    raw_token = secrets.token_urlsafe(32)
    token_hash = hashlib.sha256(raw_token.encode()).hexdigest()
    execute("UPDATE password_resets SET used=1 WHERE doctor_id=%s AND used=0", (doctor["id"],))
    execute(
        "INSERT INTO password_resets (doctor_id, token_hash, expires_at) "
        "VALUES (%s, %s, DATE_ADD(UTC_TIMESTAMP(), INTERVAL %s MINUTE))",
        (doctor["id"], token_hash, Config.RESET_TOKEN_MINUTES),
    )

    link = f"{Config.FRONTEND_URL}/reset-password?token={raw_token}"
    body = (
        f"Hello {doctor['full_name']},\n\n"
        f"Use the link below to reset your password. It is valid for "
        f"{Config.RESET_TOKEN_MINUTES} minutes.\n\n{link}\n\n"
        "If you did not request this, ignore this e-mail."
    )
    try:
        sent = send_email(email, "Reset your Doctor Management System password", body)
    except Exception as exc:  # SMTP misconfigured
        print(f"[forgot-password] could not send e-mail: {exc}")
        sent = False
    if not sent:
        # No SMTP configured: show the link in the backend terminal for local testing.
        print(f"\n[forgot-password] Reset link for {email}:\n{link}\n")
    return jsonify(generic)


@auth_bp.post("/reset-password")
def reset_password():
    data = request.get_json(silent=True) or {}
    token = data.get("token") or ""
    new_password = data.get("new_password") or ""
    problem = password_problem(new_password)
    if problem:
        return error(problem)
    if not token:
        return error("Reset token is missing")

    token_hash = hashlib.sha256(token.encode()).hexdigest()
    row = query(
        "SELECT id, doctor_id FROM password_resets "
        "WHERE token_hash=%s AND used=0 AND expires_at > UTC_TIMESTAMP()",
        (token_hash,), one=True,
    )
    if not row:
        return error("This reset link is invalid or has expired", 400)

    execute("UPDATE doctors SET password_hash=%s WHERE id=%s",
            (hash_password(new_password), row["doctor_id"]))
    execute("UPDATE password_resets SET used=1 WHERE id=%s", (row["id"],))
    return jsonify({"message": "Password updated. You can now log in."})
