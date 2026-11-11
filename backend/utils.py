import datetime
import os
import re
import smtplib
import uuid
from decimal import Decimal
from email.message import EmailMessage

from flask import jsonify
from flask.json.provider import DefaultJSONProvider
from werkzeug.utils import secure_filename

from config import Config

EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


# ---------- JSON ----------
def _json_default(o):
    if isinstance(o, datetime.datetime):
        return o.isoformat(sep=" ", timespec="seconds")
    if isinstance(o, datetime.date):
        return o.isoformat()
    if isinstance(o, datetime.timedelta):  # MySQL TIME columns
        total = int(o.total_seconds())
        return f"{total // 3600:02d}:{(total % 3600) // 60:02d}"
    if isinstance(o, Decimal):
        return float(o)
    raise TypeError(f"Not JSON serialisable: {type(o)}")


class AppJSONProvider(DefaultJSONProvider):
    def dumps(self, obj, **kwargs):
        kwargs.setdefault("default", _json_default)
        return super().dumps(obj, **kwargs)


def error(message, status=400, **extra):
    return jsonify({"error": message, **extra}), status


# ---------- validation helpers ----------
def is_valid_email(value):
    return bool(value) and bool(EMAIL_RE.match(value))


def clean(value):
    """Trim strings; turn empty strings into None."""
    if isinstance(value, str):
        value = value.strip()
        return value or None
    return value


def parse_date(value):
    try:
        return datetime.datetime.strptime(str(value), "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def parse_time(value):
    for fmt in ("%H:%M", "%H:%M:%S"):
        try:
            return datetime.datetime.strptime(str(value), fmt).time()
        except (ValueError, TypeError):
            continue
    return None


def to_number(value):
    """Return float, None for blank, or raise ValueError."""
    if value is None or (isinstance(value, str) and not value.strip()):
        return None
    return float(value)


def password_problem(password):
    if not password or len(password) < 8:
        return "Password must be at least 8 characters"
    if not re.search(r"[A-Za-z]", password) or not re.search(r"\d", password):
        return "Password must contain at least one letter and one number"
    return None


def save_image(file_storage, subfolder):
    """Validate + save an uploaded image. Returns the relative path
    (e.g. 'pets/ab12.jpg') or raises ValueError."""
    if not file_storage or not file_storage.filename:
        raise ValueError("No image selected")
    name = secure_filename(file_storage.filename)
    ext = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if ext not in Config.ALLOWED_IMAGE_EXT:
        raise ValueError("Only PNG, JPG, JPEG, WEBP or GIF images are allowed")
    folder = os.path.join(Config.UPLOAD_FOLDER, subfolder)
    os.makedirs(folder, exist_ok=True)
    filename = f"{uuid.uuid4().hex}.{ext}"
    file_storage.save(os.path.join(folder, filename))
    return f"{subfolder}/{filename}"


def remove_image(relative_path):
    if not relative_path:
        return
    full = os.path.abspath(os.path.join(Config.UPLOAD_FOLDER, relative_path))
    root = os.path.abspath(Config.UPLOAD_FOLDER)
    if full.startswith(root + os.sep) and os.path.isfile(full):
        try:
            os.remove(full)
        except OSError:
            pass


# ---------- e-mail ----------
def send_email(to_addr, subject, body):
    """Send via SMTP when configured. Returns True if sent."""
    if not Config.SMTP_HOST:
        return False
    msg = EmailMessage()
    msg["Subject"] = subject
    msg["From"] = Config.SMTP_FROM
    msg["To"] = to_addr
    msg.set_content(body)
    with smtplib.SMTP(Config.SMTP_HOST, Config.SMTP_PORT, timeout=15) as s:
        s.starttls()
        if Config.SMTP_USER:
            s.login(Config.SMTP_USER, Config.SMTP_PASSWORD)
        s.send_message(msg)
    return True
