
import pymysql
from pymysql.cursors import DictCursor

from config import Config


def get_connection():
    return pymysql.connect(
        host=Config.DB_HOST,
        port=Config.DB_PORT,
        user=Config.DB_USER,
        password=Config.DB_PASSWORD,
        database=Config.DB_NAME,
        charset="utf8mb4",
        cursorclass=DictCursor,
        autocommit=False,
    )


def query(sql, params=None, one=False):
    """Run a SELECT. Returns a list of dicts (or one dict / None if one=True)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            return cur.fetchone() if one else cur.fetchall()
    finally:
        conn.close()


def execute(sql, params=None):
    """Run INSERT / UPDATE / DELETE. Returns (last_insert_id, affected_rows)."""
    conn = get_connection()
    try:
        with conn.cursor() as cur:
            cur.execute(sql, params or ())
            conn.commit()
            return cur.lastrowid, cur.rowcount
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
