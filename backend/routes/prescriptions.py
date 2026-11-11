import datetime

from flask import Blueprint, g, jsonify, request, send_file

from auth_utils import token_required
from db import get_connection, query
from pdf_utils import build_prescription_pdf
from utils import clean, error, parse_date

prescriptions_bp = Blueprint("prescriptions", __name__, url_prefix="/api/prescriptions")

LIST_SQL = (
    "SELECT r.id, r.patient_id, r.appointment_id, r.diagnosis, r.notes, r.prescribed_on, "
    "p.pet_name, p.species, p.owner_name, "
    "(SELECT COUNT(*) FROM prescription_medicines m WHERE m.prescription_id=r.id) AS medicine_count "
    "FROM prescriptions r JOIN patients p ON p.id=r.patient_id "
)


def _get_full(rx_id):
    rx = query(LIST_SQL + "WHERE r.id=%s AND r.doctor_id=%s", (rx_id, g.doctor_id), one=True)
    if not rx:
        return None
    rx["medicines"] = query(
        "SELECT id, medicine_name, dosage, frequency, duration, instructions "
        "FROM prescription_medicines WHERE prescription_id=%s ORDER BY sort_order, id", (rx_id,))
    return rx


def _validate(data):
    pid = data.get("patient_id")
    if not pid or not str(pid).isdigit():
        return None, "Select a patient"
    if not query("SELECT id FROM patients WHERE id=%s AND doctor_id=%s", (pid, g.doctor_id), one=True):
        return None, "Patient not found"
    appt_id = data.get("appointment_id") or None
    if appt_id:
        if not str(appt_id).isdigit() or not query(
                "SELECT id FROM appointments WHERE id=%s AND doctor_id=%s AND patient_id=%s",
                (appt_id, g.doctor_id, pid), one=True):
            return None, "Selected appointment does not belong to this patient"
        appt_id = int(appt_id)
    diagnosis = clean(data.get("diagnosis"))
    if not diagnosis:
        return None, "Diagnosis is required"
    meds = []
    for m in data.get("medicines") or []:
        name = clean(m.get("medicine_name"))
        if not name:
            continue
        meds.append({
            "medicine_name": name[:150],
            "dosage": (clean(m.get("dosage")) or "")[:100] or None,
            "frequency": (clean(m.get("frequency")) or "")[:100] or None,
            "duration": (clean(m.get("duration")) or "")[:100] or None,
            "instructions": (clean(m.get("instructions")) or "")[:255] or None,
        })
    if not meds:
        return None, "Add at least one medicine"
    when = parse_date(data.get("prescribed_on")) if data.get("prescribed_on") else datetime.date.today()
    if not when:
        return None, "Enter a valid prescription date"
    return {"patient_id": int(pid), "appointment_id": appt_id, "diagnosis": diagnosis[:255],
            "notes": clean(data.get("notes")), "prescribed_on": when, "medicines": meds}, None


def _insert_medicines(cur, rx_id, meds):
    for i, m in enumerate(meds):
        cur.execute(
            "INSERT INTO prescription_medicines (prescription_id, medicine_name, dosage, frequency, "
            "duration, instructions, sort_order) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (rx_id, m["medicine_name"], m["dosage"], m["frequency"], m["duration"], m["instructions"], i))


@prescriptions_bp.get("")
@token_required
def list_prescriptions():
    sql = LIST_SQL + "WHERE r.doctor_id=%s"
    params = [g.doctor_id]
    search = clean(request.args.get("search"))
    if search:
        like = f"%{search}%"
        sql += (" AND (p.pet_name LIKE %s OR p.owner_name LIKE %s OR r.diagnosis LIKE %s OR EXISTS "
                "(SELECT 1 FROM prescription_medicines m WHERE m.prescription_id=r.id AND m.medicine_name LIKE %s))")
        params += [like, like, like, like]
    pid = request.args.get("patient_id")
    if pid and pid.isdigit():
        sql += " AND r.patient_id=%s"
        params.append(int(pid))
    sql += " ORDER BY r.prescribed_on DESC, r.id DESC"
    return jsonify(query(sql, params))


@prescriptions_bp.get("/history/<int:patient_id>")
@token_required
def patient_history(patient_id):
    """Prescription history of one patient, including medicines."""
    rows = query(LIST_SQL + "WHERE r.doctor_id=%s AND r.patient_id=%s "
                 "ORDER BY r.prescribed_on DESC, r.id DESC", (g.doctor_id, patient_id))
    for r in rows:
        r["medicines"] = query(
            "SELECT medicine_name, dosage, frequency, duration, instructions "
            "FROM prescription_medicines WHERE prescription_id=%s ORDER BY sort_order, id", (r["id"],))
    return jsonify(rows)


@prescriptions_bp.get("/medicines")
@token_required
def medicine_details():
    """Previously used medicines (with their last dosage etc.) for autocomplete."""
    term = clean(request.args.get("q")) or ""
    rows = query(
        "SELECT m.medicine_name, m.dosage, m.frequency, m.duration, m.instructions "
        "FROM prescription_medicines m JOIN prescriptions r ON r.id=m.prescription_id "
        "WHERE r.doctor_id=%s AND m.medicine_name LIKE %s AND m.id IN ("
        "  SELECT MAX(m2.id) FROM prescription_medicines m2 JOIN prescriptions r2 ON r2.id=m2.prescription_id "
        "  WHERE r2.doctor_id=%s GROUP BY m2.medicine_name) "
        "ORDER BY m.medicine_name LIMIT 30", (g.doctor_id, f"%{term}%", g.doctor_id))
    return jsonify(rows)


@prescriptions_bp.get("/<int:rx_id>")
@token_required
def get_prescription(rx_id):
    rx = _get_full(rx_id)
    return jsonify(rx) if rx else error("Prescription not found", 404)


@prescriptions_bp.post("")
@token_required
def create_prescription():
    data, msg = _validate(request.get_json(silent=True) or {})
    if msg:
        return error(msg)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "INSERT INTO prescriptions (doctor_id, patient_id, appointment_id, diagnosis, notes, prescribed_on) "
                "VALUES (%s,%s,%s,%s,%s,%s)",
                (g.doctor_id, data["patient_id"], data["appointment_id"], data["diagnosis"],
                 data["notes"], data["prescribed_on"]))
            rx_id = cur.lastrowid
            _insert_medicines(cur, rx_id, data["medicines"])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return jsonify(_get_full(rx_id)), 201


@prescriptions_bp.put("/<int:rx_id>")
@token_required
def update_prescription(rx_id):
    if not _get_full(rx_id):
        return error("Prescription not found", 404)
    data, msg = _validate(request.get_json(silent=True) or {})
    if msg:
        return error(msg)
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "UPDATE prescriptions SET patient_id=%s, appointment_id=%s, diagnosis=%s, notes=%s, "
                "prescribed_on=%s WHERE id=%s AND doctor_id=%s",
                (data["patient_id"], data["appointment_id"], data["diagnosis"], data["notes"],
                 data["prescribed_on"], rx_id, g.doctor_id))
            cur.execute("DELETE FROM prescription_medicines WHERE prescription_id=%s", (rx_id,))
            _insert_medicines(cur, rx_id, data["medicines"])
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
    return jsonify(_get_full(rx_id))


@prescriptions_bp.delete("/<int:rx_id>")
@token_required
def delete_prescription(rx_id):
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("DELETE FROM prescriptions WHERE id=%s AND doctor_id=%s", (rx_id, g.doctor_id))
            count = cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return jsonify({"message": "Prescription deleted"}) if count else error("Prescription not found", 404)


def _pdf_response(rx_id, as_attachment):
    rx = _get_full(rx_id)
    if not rx:
        return error("Prescription not found", 404)
    doctor = query("SELECT * FROM doctors WHERE id=%s", (g.doctor_id,), one=True)
    patient = query("SELECT * FROM patients WHERE id=%s", (rx["patient_id"],), one=True)
    pdf = build_prescription_pdf(rx, doctor, patient, rx["medicines"])
    safe_pet = "".join(c for c in patient["pet_name"] if c.isalnum()) or "patient"
    return send_file(pdf, mimetype="application/pdf", as_attachment=as_attachment,
                     download_name=f"prescription_{rx_id}_{safe_pet}.pdf")


@prescriptions_bp.get("/<int:rx_id>/pdf")
@token_required
def view_pdf(rx_id):
    return _pdf_response(rx_id, as_attachment=False)


@prescriptions_bp.get("/<int:rx_id>/download")
@token_required
def download_pdf(rx_id):
    return _pdf_response(rx_id, as_attachment=True)
