import datetime

from flask import Blueprint, g, jsonify, request

from auth_utils import token_required
from db import execute, query
from utils import clean, error, parse_date, parse_time

appointments_bp = Blueprint("appointments", __name__, url_prefix="/api/appointments")

STATUSES = ["Waiting", "Confirmed", "In Consultation", "Completed", "Cancelled"]
VISIT_TYPES = ["Clinic", "Home Visit", "Video Consultation", "Emergency"]

SELECT = (
    "SELECT a.id, a.patient_id, a.appointment_date, a.appointment_time, a.reason, a.notes, "
    "a.visit_type, a.status, a.created_at, "
    "p.pet_name, p.species, p.breed, p.owner_name, p.owner_phone, p.image AS pet_image "
    "FROM appointments a JOIN patients p ON p.id = a.patient_id "
)


def _get(appt_id):
    return query(SELECT + "WHERE a.id=%s AND a.doctor_id=%s", (appt_id, g.doctor_id), one=True)


def _validate(data, partial=False):
    """Returns (clean_dict, error_message)."""
    out = {}
    if not partial or "patient_id" in data:
        pid = data.get("patient_id")
        if not pid or not str(pid).isdigit():
            return None, "Select a patient"
        if not query("SELECT id FROM patients WHERE id=%s AND doctor_id=%s", (pid, g.doctor_id), one=True):
            return None, "Patient not found"
        out["patient_id"] = int(pid)
    if not partial or "appointment_date" in data:
        d = parse_date(data.get("appointment_date"))
        if not d:
            return None, "Enter a valid date (YYYY-MM-DD)"
        out["appointment_date"] = d
    if not partial or "appointment_time" in data:
        t = parse_time(data.get("appointment_time"))
        if not t:
            return None, "Enter a valid time"
        out["appointment_time"] = t
    if not partial or "reason" in data:
        reason = clean(data.get("reason"))
        if not reason:
            return None, "Reason is required"
        out["reason"] = reason[:255]
    if "notes" in data:
        out["notes"] = clean(data.get("notes"))
    if not partial or "visit_type" in data:
        vt = data.get("visit_type") or "Clinic"
        if vt not in VISIT_TYPES:
            return None, "Invalid visit type"
        out["visit_type"] = vt
    if not partial or "status" in data:
        st = data.get("status") or "Waiting"
        if st not in STATUSES:
            return None, "Invalid status"
        out["status"] = st
    return out, None


@appointments_bp.get("")
@token_required
def list_appointments():
    """Filters: search, status, visit_type, date, from, to, patient_id"""
    sql = SELECT + "WHERE a.doctor_id=%s"
    params = [g.doctor_id]

    search = clean(request.args.get("search"))
    if search:
        like = f"%{search}%"
        sql += " AND (p.pet_name LIKE %s OR p.owner_name LIKE %s OR a.reason LIKE %s OR p.owner_phone LIKE %s)"
        params += [like, like, like, like]
    status = request.args.get("status")
    if status:
        if status not in STATUSES:
            return error("Invalid status filter")
        sql += " AND a.status=%s"
        params.append(status)
    visit_type = request.args.get("visit_type")
    if visit_type:
        if visit_type not in VISIT_TYPES:
            return error("Invalid visit type filter")
        sql += " AND a.visit_type=%s"
        params.append(visit_type)
    day = parse_date(request.args.get("date"))
    if day:
        sql += " AND a.appointment_date=%s"
        params.append(day)
    d_from, d_to = parse_date(request.args.get("from")), parse_date(request.args.get("to"))
    if d_from:
        sql += " AND a.appointment_date>=%s"
        params.append(d_from)
    if d_to:
        sql += " AND a.appointment_date<=%s"
        params.append(d_to)
    pid = request.args.get("patient_id")
    if pid and pid.isdigit():
        sql += " AND a.patient_id=%s"
        params.append(int(pid))

    sql += " ORDER BY a.appointment_date DESC, a.appointment_time DESC"
    return jsonify(query(sql, params))


@appointments_bp.get("/calendar")
@token_required
def calendar():
    """All appointments of one month: /calendar?month=2026-11"""
    month = request.args.get("month") or datetime.date.today().strftime("%Y-%m")
    first = parse_date(month + "-01")
    if not first:
        return error("month must look like 2026-11")
    nxt = (first.replace(day=28) + datetime.timedelta(days=4)).replace(day=1)
    rows = query(SELECT + "WHERE a.doctor_id=%s AND a.appointment_date >= %s AND a.appointment_date < %s "
                 "ORDER BY a.appointment_date, a.appointment_time", (g.doctor_id, first, nxt))
    return jsonify(rows)


@appointments_bp.get("/<int:appt_id>")
@token_required
def get_appointment(appt_id):
    row = _get(appt_id)
    return jsonify(row) if row else error("Appointment not found", 404)


@appointments_bp.post("")
@token_required
def create_appointment():
    data, msg = _validate(request.get_json(silent=True) or {})
    if msg:
        return error(msg)
    new_id, _ = execute(
        "INSERT INTO appointments (doctor_id, patient_id, appointment_date, appointment_time, "
        "reason, notes, visit_type, status) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
        (g.doctor_id, data["patient_id"], data["appointment_date"], data["appointment_time"],
         data["reason"], data.get("notes"), data["visit_type"], data["status"]))
    return jsonify(_get(new_id)), 201


@appointments_bp.put("/<int:appt_id>")
@token_required
def update_appointment(appt_id):
    if not _get(appt_id):
        return error("Appointment not found", 404)
    data, msg = _validate(request.get_json(silent=True) or {}, partial=True)
    if msg:
        return error(msg)
    if not data:
        return error("Nothing to update")
    cols = ", ".join(f"{k}=%s" for k in data)  # keys come from our own whitelist above
    execute(f"UPDATE appointments SET {cols} WHERE id=%s AND doctor_id=%s",
            (*data.values(), appt_id, g.doctor_id))
    return jsonify(_get(appt_id))


@appointments_bp.patch("/<int:appt_id>/status")
@token_required
def update_status(appt_id):
    status = (request.get_json(silent=True) or {}).get("status")
    if status not in STATUSES:
        return error(f"Status must be one of: {', '.join(STATUSES)}")
    if not _get(appt_id):
        return error("Appointment not found", 404)
    execute("UPDATE appointments SET status=%s WHERE id=%s AND doctor_id=%s",
            (status, appt_id, g.doctor_id))
    return jsonify(_get(appt_id))


@appointments_bp.post("/<int:appt_id>/cancel")
@token_required
def cancel_appointment(appt_id):
    if not _get(appt_id):
        return error("Appointment not found", 404)
    execute("UPDATE appointments SET status='Cancelled' WHERE id=%s AND doctor_id=%s",
            (appt_id, g.doctor_id))
    return jsonify(_get(appt_id))


@appointments_bp.delete("/<int:appt_id>")
@token_required
def delete_appointment(appt_id):
    _, count = execute("DELETE FROM appointments WHERE id=%s AND doctor_id=%s", (appt_id, g.doctor_id))
    if not count:
        return error("Appointment not found", 404)
    return jsonify({"message": "Appointment deleted"})
