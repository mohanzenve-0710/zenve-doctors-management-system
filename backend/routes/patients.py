import datetime

from flask import Blueprint, g, jsonify, request

from auth_utils import token_required
from db import execute, query
from utils import (clean, error, is_valid_email, parse_date, remove_image,
                   save_image, to_number)

patients_bp = Blueprint("patients", __name__, url_prefix="/api/patients")

GENDERS = ["Male", "Female", "Unknown"]


def _get(pid):
    return query("SELECT * FROM patients WHERE id=%s AND doctor_id=%s", (pid, g.doctor_id), one=True)


def _validate(data):
    owner_name = clean(data.get("owner_name"))
    owner_phone = clean(data.get("owner_phone"))
    pet_name = clean(data.get("pet_name"))
    species = clean(data.get("species"))
    if not owner_name:
        return None, "Owner name is required"
    if not owner_phone or len(owner_phone.replace(" ", "").replace("-", "").replace("+", "")) < 10 \
            or not owner_phone.replace(" ", "").replace("-", "").replace("+", "").isdigit():
        return None, "Enter a valid owner phone number (at least 10 digits)"
    if not pet_name:
        return None, "Pet name is required"
    if not species:
        return None, "Species is required"
    email = clean(data.get("owner_email"))
    if email and not is_valid_email(email):
        return None, "Enter a valid owner email address"
    gender = data.get("gender") or "Unknown"
    if gender not in GENDERS:
        return None, "Invalid gender"
    try:
        age = to_number(data.get("age"))
        weight = to_number(data.get("weight"))
    except (ValueError, TypeError):
        return None, "Age and weight must be numbers"
    if age is not None and not (0 <= age <= 100):
        return None, "Age must be between 0 and 100"
    if weight is not None and not (0 < weight <= 2000):
        return None, "Weight must be a positive number (kg)"
    return {
        "owner_name": owner_name, "owner_phone": owner_phone, "owner_email": email,
        "owner_address": clean(data.get("owner_address")),
        "pet_name": pet_name, "species": species, "breed": clean(data.get("breed")),
        "age": age, "gender": gender, "weight": weight,
        "blood_group": clean(data.get("blood_group")), "notes": clean(data.get("notes")),
    }, None


@patients_bp.get("")
@token_required
def list_patients():
    sql = "SELECT * FROM patients WHERE doctor_id=%s"
    params = [g.doctor_id]
    search = clean(request.args.get("search"))
    if search:
        like = f"%{search}%"
        sql += (" AND (pet_name LIKE %s OR owner_name LIKE %s OR owner_phone LIKE %s "
                "OR breed LIKE %s OR species LIKE %s)")
        params += [like] * 5
    species = clean(request.args.get("species"))
    if species:
        sql += " AND species=%s"
        params.append(species)
    sql += " ORDER BY created_at DESC, id DESC"
    return jsonify(query(sql, params))


@patients_bp.get("/search")
@token_required
def search_patients():
    """Light-weight search used by dropdowns / autocomplete."""
    term = clean(request.args.get("q")) or ""
    like = f"%{term}%"
    rows = query(
        "SELECT id, pet_name, species, owner_name, owner_phone, image FROM patients "
        "WHERE doctor_id=%s AND (pet_name LIKE %s OR owner_name LIKE %s OR owner_phone LIKE %s) "
        "ORDER BY pet_name LIMIT 20", (g.doctor_id, like, like, like))
    return jsonify(rows)


@patients_bp.post("")
@token_required
def create_patient():
    data, msg = _validate(request.get_json(silent=True) or {})
    if msg:
        return error(msg)
    new_id, _ = execute(
        "INSERT INTO patients (doctor_id, owner_name, owner_phone, owner_email, owner_address, "
        "pet_name, species, breed, age, gender, weight, blood_group, notes) "
        "VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)",
        (g.doctor_id, data["owner_name"], data["owner_phone"], data["owner_email"],
         data["owner_address"], data["pet_name"], data["species"], data["breed"], data["age"],
         data["gender"], data["weight"], data["blood_group"], data["notes"]))
    return jsonify(_get(new_id)), 201


@patients_bp.get("/<int:pid>")
@token_required
def patient_profile(pid):
    patient = _get(pid)
    if not patient:
        return error("Patient not found", 404)
    history = query("SELECT * FROM medical_history WHERE patient_id=%s "
                    "ORDER BY recorded_on DESC, id DESC", (pid,))
    vaccinations = query("SELECT * FROM vaccinations WHERE patient_id=%s "
                         "ORDER BY given_on DESC, id DESC", (pid,))
    visits = query("SELECT id, appointment_date, appointment_time, reason, visit_type, status "
                   "FROM appointments WHERE patient_id=%s AND doctor_id=%s "
                   "ORDER BY appointment_date DESC, appointment_time DESC", (pid, g.doctor_id))
    prescriptions = query("SELECT id, diagnosis, prescribed_on FROM prescriptions "
                          "WHERE patient_id=%s AND doctor_id=%s ORDER BY prescribed_on DESC, id DESC",
                          (pid, g.doctor_id))
    return jsonify({**patient, "medical_history": history, "vaccinations": vaccinations,
                    "visits": visits, "prescriptions": prescriptions})


@patients_bp.put("/<int:pid>")
@token_required
def update_patient(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    data, msg = _validate(request.get_json(silent=True) or {})
    if msg:
        return error(msg)
    cols = ", ".join(f"{k}=%s" for k in data)  # keys are our own fixed whitelist
    execute(f"UPDATE patients SET {cols} WHERE id=%s AND doctor_id=%s",
            (*data.values(), pid, g.doctor_id))
    return jsonify(_get(pid))


@patients_bp.delete("/<int:pid>")
@token_required
def delete_patient(pid):
    patient = _get(pid)
    if not patient:
        return error("Patient not found", 404)
    execute("DELETE FROM patients WHERE id=%s AND doctor_id=%s", (pid, g.doctor_id))
    remove_image(patient.get("image"))
    return jsonify({"message": "Patient deleted"})


# ---------- image ----------
@patients_bp.post("/<int:pid>/image")
@token_required
def upload_image(pid):
    patient = _get(pid)
    if not patient:
        return error("Patient not found", 404)
    try:
        path = save_image(request.files.get("image"), "pets")
    except ValueError as exc:
        return error(str(exc))
    execute("UPDATE patients SET image=%s WHERE id=%s", (path, pid))
    remove_image(patient.get("image"))
    return jsonify({"image": path})


# ---------- medical history ----------
@patients_bp.get("/<int:pid>/medical-history")
@token_required
def get_history(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    return jsonify(query("SELECT * FROM medical_history WHERE patient_id=%s "
                         "ORDER BY recorded_on DESC, id DESC", (pid,)))


@patients_bp.post("/<int:pid>/medical-history")
@token_required
def add_history(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    data = request.get_json(silent=True) or {}
    title = clean(data.get("title"))
    if not title:
        return error("Title is required")
    recorded_on = parse_date(data.get("recorded_on")) or datetime.date.today()
    new_id, _ = execute(
        "INSERT INTO medical_history (patient_id, title, description, recorded_on) VALUES (%s,%s,%s,%s)",
        (pid, title[:150], clean(data.get("description")), recorded_on))
    return jsonify(query("SELECT * FROM medical_history WHERE id=%s", (new_id,), one=True)), 201


@patients_bp.delete("/<int:pid>/medical-history/<int:hid>")
@token_required
def delete_history(pid, hid):
    if not _get(pid):
        return error("Patient not found", 404)
    _, count = execute("DELETE FROM medical_history WHERE id=%s AND patient_id=%s", (hid, pid))
    return jsonify({"message": "Deleted"}) if count else error("Entry not found", 404)


# ---------- vaccinations ----------
@patients_bp.get("/<int:pid>/vaccinations")
@token_required
def get_vaccinations(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    return jsonify(query("SELECT * FROM vaccinations WHERE patient_id=%s "
                         "ORDER BY given_on DESC, id DESC", (pid,)))


@patients_bp.post("/<int:pid>/vaccinations")
@token_required
def add_vaccination(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    data = request.get_json(silent=True) or {}
    name = clean(data.get("vaccine_name"))
    given = parse_date(data.get("given_on"))
    if not name:
        return error("Vaccine name is required")
    if not given:
        return error("Enter the date the vaccine was given")
    due = parse_date(data.get("next_due_on")) if clean(data.get("next_due_on")) else None
    if clean(data.get("next_due_on")) and not due:
        return error("Enter a valid next due date")
    new_id, _ = execute(
        "INSERT INTO vaccinations (patient_id, vaccine_name, given_on, next_due_on, notes) "
        "VALUES (%s,%s,%s,%s,%s)", (pid, name[:150], given, due, clean(data.get("notes"))))
    return jsonify(query("SELECT * FROM vaccinations WHERE id=%s", (new_id,), one=True)), 201


@patients_bp.delete("/<int:pid>/vaccinations/<int:vid>")
@token_required
def delete_vaccination(pid, vid):
    if not _get(pid):
        return error("Patient not found", 404)
    _, count = execute("DELETE FROM vaccinations WHERE id=%s AND patient_id=%s", (vid, pid))
    return jsonify({"message": "Deleted"}) if count else error("Entry not found", 404)


# ---------- previous visits ----------
@patients_bp.get("/<int:pid>/visits")
@token_required
def get_visits(pid):
    if not _get(pid):
        return error("Patient not found", 404)
    return jsonify(query(
        "SELECT id, appointment_date, appointment_time, reason, visit_type, status "
        "FROM appointments WHERE patient_id=%s AND doctor_id=%s "
        "ORDER BY appointment_date DESC, appointment_time DESC", (pid, g.doctor_id)))
