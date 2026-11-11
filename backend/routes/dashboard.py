import datetime

from flask import Blueprint, g, jsonify, request

from auth_utils import token_required
from db import query
from utils import error

dashboard_bp = Blueprint("dashboard", __name__, url_prefix="/api/dashboard")

STATUSES = ["Waiting", "Confirmed", "In Consultation", "Completed", "Cancelled"]


@dashboard_bp.get("/stats")
@token_required
def stats():
    d = g.doctor_id
    a = query(
        "SELECT COUNT(*) AS total, "
        "COALESCE(SUM(appointment_date = CURDATE()),0) AS today, "
        "COALESCE(SUM(status='Completed'),0) AS completed, "
        "COALESCE(SUM(status IN ('Waiting','Confirmed')),0) AS pending "
        "FROM appointments WHERE doctor_id=%s", (d,), one=True)
    patients = query("SELECT COUNT(*) AS c FROM patients WHERE doctor_id=%s", (d,), one=True)["c"]
    rx = query("SELECT COUNT(*) AS c FROM prescriptions WHERE doctor_id=%s", (d,), one=True)["c"]
    rows = query("SELECT status, COUNT(*) AS c FROM appointments WHERE doctor_id=%s GROUP BY status", (d,))
    counts = {r["status"]: r["c"] for r in rows}
    return jsonify({
        "total_appointments": int(a["total"]),
        "today_appointments": int(a["today"]),
        "total_patients": patients,
        "completed_consultations": int(a["completed"]),
        "pending_appointments": int(a["pending"]),
        "total_prescriptions": rx,
        "status_overview": [{"status": s, "count": counts.get(s, 0)} for s in STATUSES],
    })


@dashboard_bp.get("/analytics")
@token_required
def analytics():
    """period=weekly  -> last 7 days, one point per day
       period=monthly -> last 6 months, one point per month"""
    period = request.args.get("period", "weekly")
    d = g.doctor_id
    today = datetime.date.today()

    if period == "weekly":
        start = today - datetime.timedelta(days=6)
        rows = query(
            "SELECT appointment_date AS k, COUNT(*) AS total, "
            "SUM(status='Completed') AS completed, SUM(status='Cancelled') AS cancelled "
            "FROM appointments WHERE doctor_id=%s AND appointment_date BETWEEN %s AND %s "
            "GROUP BY appointment_date", (d, start, today))
        by_key = {r["k"].isoformat(): r for r in rows}
        data = []
        for i in range(7):
            day = start + datetime.timedelta(days=i)
            r = by_key.get(day.isoformat())
            data.append({
                "label": day.strftime("%a %d"),
                "total": int(r["total"]) if r else 0,
                "completed": int(r["completed"] or 0) if r else 0,
                "cancelled": int(r["cancelled"] or 0) if r else 0,
            })
    elif period == "monthly":
        first = today.replace(day=1)
        months = []
        y, m = first.year, first.month
        for _ in range(6):
            months.append((y, m))
            m -= 1
            if m == 0:
                y, m = y - 1, 12
        months.reverse()
        start = datetime.date(months[0][0], months[0][1], 1)
        rows = query(
            "SELECT DATE_FORMAT(appointment_date,'%%Y-%%m') AS k, COUNT(*) AS total, "
            "SUM(status='Completed') AS completed, SUM(status='Cancelled') AS cancelled "
            "FROM appointments WHERE doctor_id=%s AND appointment_date >= %s "
            "GROUP BY k", (d, start))
        by_key = {r["k"]: r for r in rows}
        data = []
        for (yy, mm) in months:
            r = by_key.get(f"{yy}-{mm:02d}")
            data.append({
                "label": datetime.date(yy, mm, 1).strftime("%b %Y"),
                "total": int(r["total"]) if r else 0,
                "completed": int(r["completed"] or 0) if r else 0,
                "cancelled": int(r["cancelled"] or 0) if r else 0,
            })
    else:
        return error("period must be 'weekly' or 'monthly'")
    return jsonify({"period": period, "data": data})


@dashboard_bp.get("/patient-stats")
@token_required
def patient_stats():
    d = g.doctor_id
    total = query("SELECT COUNT(*) AS c FROM patients WHERE doctor_id=%s", (d,), one=True)["c"]
    new_month = query(
        "SELECT COUNT(*) AS c FROM patients WHERE doctor_id=%s "
        "AND YEAR(created_at)=YEAR(CURDATE()) AND MONTH(created_at)=MONTH(CURDATE())",
        (d,), one=True)["c"]
    species = query(
        "SELECT species, COUNT(*) AS count FROM patients WHERE doctor_id=%s "
        "GROUP BY species ORDER BY count DESC", (d,))
    return jsonify({"total": total, "new_this_month": new_month, "by_species": species})


APPT_SELECT = (
    "SELECT a.id, a.appointment_date, a.appointment_time, a.reason, a.status, a.visit_type, "
    "p.pet_name, p.species, p.owner_name "
    "FROM appointments a JOIN patients p ON p.id = a.patient_id "
)


@dashboard_bp.get("/today")
@token_required
def today_appointments():
    rows = query(APPT_SELECT + "WHERE a.doctor_id=%s AND a.appointment_date=CURDATE() "
                 "ORDER BY a.appointment_time", (g.doctor_id,))
    return jsonify(rows)


@dashboard_bp.get("/recent-appointments")
@token_required
def recent_appointments():
    rows = query(APPT_SELECT + "WHERE a.doctor_id=%s "
                 "ORDER BY a.appointment_date DESC, a.appointment_time DESC LIMIT 8", (g.doctor_id,))
    return jsonify(rows)


@dashboard_bp.get("/recent-patients")
@token_required
def recent_patients():
    rows = query(
        "SELECT id, pet_name, species, breed, owner_name, owner_phone, image, created_at "
        "FROM patients WHERE doctor_id=%s ORDER BY created_at DESC, id DESC LIMIT 6", (g.doctor_id,))
    return jsonify(rows)


@dashboard_bp.get("/recent-activities")
@token_required
def recent_activities():
    d = g.doctor_id
    rows = query(
        "(SELECT 'appointment' AS type, CONCAT('Appointment ', LOWER(a.status), ' for ', p.pet_name) AS text, "
        "  a.updated_at AS happened_at FROM appointments a JOIN patients p ON p.id=a.patient_id WHERE a.doctor_id=%s) "
        "UNION ALL "
        "(SELECT 'patient', CONCAT('New patient added: ', pet_name, ' (', owner_name, ')'), created_at "
        "  FROM patients WHERE doctor_id=%s) "
        "UNION ALL "
        "(SELECT 'prescription', CONCAT('Prescription created for ', p.pet_name, ' - ', r.diagnosis), r.created_at "
        "  FROM prescriptions r JOIN patients p ON p.id=r.patient_id WHERE r.doctor_id=%s) "
        "ORDER BY happened_at DESC LIMIT 10", (d, d, d))
    return jsonify(rows)


@dashboard_bp.get("/reports")
@token_required
def reports():
    """Summary report: period=weekly (last 7 days) or monthly (last 30 days)."""
    period = request.args.get("period", "weekly")
    if period not in ("weekly", "monthly"):
        return error("period must be 'weekly' or 'monthly'")
    days = 6 if period == "weekly" else 29
    today = datetime.date.today()
    start = today - datetime.timedelta(days=days)
    d = g.doctor_id

    by_status = query(
        "SELECT status, COUNT(*) AS count FROM appointments "
        "WHERE doctor_id=%s AND appointment_date BETWEEN %s AND %s GROUP BY status", (d, start, today))
    by_visit = query(
        "SELECT visit_type, COUNT(*) AS count FROM appointments "
        "WHERE doctor_id=%s AND appointment_date BETWEEN %s AND %s GROUP BY visit_type", (d, start, today))
    new_patients = query(
        "SELECT COUNT(*) AS c FROM patients WHERE doctor_id=%s AND DATE(created_at) BETWEEN %s AND %s",
        (d, start, today), one=True)["c"]
    rx = query(
        "SELECT COUNT(*) AS c FROM prescriptions WHERE doctor_id=%s AND prescribed_on BETWEEN %s AND %s",
        (d, start, today), one=True)["c"]
    return jsonify({
        "period": period,
        "from": start,
        "to": today,
        "total_appointments": sum(r["count"] for r in by_status),
        "by_status": by_status,
        "by_visit_type": by_visit,
        "new_patients": new_patients,
        "prescriptions_issued": rx,
    })
