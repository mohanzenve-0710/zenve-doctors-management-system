from flask import Blueprint, g, jsonify, request

from auth_utils import hash_password, token_required, verify_password
from db import execute, query
from utils import (clean, error, is_valid_email, password_problem, remove_image,
                   save_image)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")

FIELDS = ("id, full_name, email, phone, qualification, specialization, experience_years, "
          "clinic_name, clinic_address, address, profile_image, last_login, created_at")


def _doctor():
    return query(f"SELECT {FIELDS} FROM doctors WHERE id=%s", (g.doctor_id,), one=True)


@profile_bp.get("")
@token_required
def get_profile():
    return jsonify(_doctor())


@profile_bp.put("")
@token_required
def update_profile():
    data = request.get_json(silent=True) or {}
    full_name = clean(data.get("full_name"))
    email = (clean(data.get("email")) or "").lower()
    phone = clean(data.get("phone"))
    if not full_name:
        return error("Full name is required")
    if not is_valid_email(email):
        return error("Enter a valid email address")
    digits = (phone or "").replace("+", "").replace(" ", "").replace("-", "")
    if not digits.isdigit() or len(digits) < 10:
        return error("Enter a valid mobile number (at least 10 digits)")
    if query("SELECT id FROM doctors WHERE email=%s AND id<>%s", (email, g.doctor_id), one=True):
        return error("That email is already used by another account", 409)

    exp = clean(data.get("experience_years"))
    if exp is not None:
        if not str(exp).isdigit() or int(exp) > 80:
            return error("Experience must be a whole number of years (0-80)")
        exp = int(exp)

    execute(
        "UPDATE doctors SET full_name=%s, email=%s, phone=%s, qualification=%s, specialization=%s, "
        "experience_years=%s, clinic_name=%s, clinic_address=%s, address=%s WHERE id=%s",
        (full_name, email, phone, clean(data.get("qualification")), clean(data.get("specialization")),
         exp, clean(data.get("clinic_name")), clean(data.get("clinic_address")),
         clean(data.get("address")), g.doctor_id))
    return jsonify(_doctor())


@profile_bp.post("/image")
@token_required
def upload_profile_image():
    current = _doctor()
    try:
        path = save_image(request.files.get("image"), "doctors")
    except ValueError as exc:
        return error(str(exc))
    execute("UPDATE doctors SET profile_image=%s WHERE id=%s", (path, g.doctor_id))
    remove_image(current.get("profile_image"))
    return jsonify({"profile_image": path})


@profile_bp.post("/change-password")
@token_required
def change_password():
    data = request.get_json(silent=True) or {}
    current = data.get("current_password") or ""
    new = data.get("new_password") or ""
    row = query("SELECT password_hash FROM doctors WHERE id=%s", (g.doctor_id,), one=True)
    if not verify_password(row["password_hash"], current):
        return error("Current password is incorrect", 400)
    problem = password_problem(new)
    if problem:
        return error(problem)
    if current == new:
        return error("New password must be different from the current password")
    execute("UPDATE doctors SET password_hash=%s WHERE id=%s", (hash_password(new), g.doctor_id))
    return jsonify({"message": "Password changed successfully"})


@profile_bp.get("/account")
@token_required
def account_details():
    d = g.doctor_id
    doctor = _doctor()
    counts = {
        "patients": query("SELECT COUNT(*) AS c FROM patients WHERE doctor_id=%s", (d,), one=True)["c"],
        "appointments": query("SELECT COUNT(*) AS c FROM appointments WHERE doctor_id=%s", (d,), one=True)["c"],
        "prescriptions": query("SELECT COUNT(*) AS c FROM prescriptions WHERE doctor_id=%s", (d,), one=True)["c"],
    }
    return jsonify({"member_since": doctor["created_at"], "last_login": doctor["last_login"],
                    "email": doctor["email"], "totals": counts})
