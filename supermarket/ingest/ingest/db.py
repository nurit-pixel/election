"""גישה למסד הנתונים וטעינת קבצים. כל קובץ נטען בטרנזקציה אחת:
אם הטעינה נכשלת, המחירים הקודמים של הסניף נשארים כמו שהם."""
from __future__ import annotations

import glob
import os
from datetime import datetime
from typing import Optional

import psycopg

from .chains import CHAINS, Chain


class EmptyFile(ValueError):
    """קובץ תקין בלי שורות (למשל סניף סגור). לא נטען ולא נחשב ככשל."""


def connect(database_url: str) -> psycopg.Connection:
    # autocommit: כל פקודה בודדת נשמרת מיד, ו-conn.transaction() פותח טרנזקציה אמיתית.
    # הזמנים בקבצים הם שעון ישראל בלי אזור זמן.
    return psycopg.connect(database_url, autocommit=True, options="-c TimeZone=Asia/Jerusalem")


def apply_schema(conn: psycopg.Connection, schema_dir: str) -> None:
    for path in sorted(glob.glob(os.path.join(schema_dir, "*.sql"))):
        with open(path, encoding="utf-8") as f:
            conn.execute(f.read())
    for order, chain in enumerate(CHAINS.values()):
        conn.execute(
            """INSERT INTO chains (key, name, is_pharm, sort_order) VALUES (%s, %s, %s, %s)
               ON CONFLICT (key) DO UPDATE
               SET name = EXCLUDED.name, is_pharm = EXCLUDED.is_pharm,
                   sort_order = EXCLUDED.sort_order""",
            (chain.key, chain.name, chain.is_pharm, order),
        )


# ---------- ריצות וקבצים ----------

def start_run(conn, chain: Chain, kind: str) -> int:
    return conn.execute(
        "INSERT INTO ingest_runs (chain_key, kind) VALUES (%s, %s) RETURNING id",
        (chain.key, kind),
    ).fetchone()[0]


def finish_run(conn, run_id: int, status: str, loaded: int, failed: int, rows: int,
               error: Optional[str]) -> None:
    conn.execute(
        """UPDATE ingest_runs SET finished_at = now(), status = %s, files_loaded = %s,
               files_failed = %s, rows_loaded = %s, error = %s WHERE id = %s""",
        (status, loaded, failed, rows, error, run_id),
    )


def close_stale_runs(conn) -> None:
    """ריצות שנקטעו (למשל כשהשרת כובה) מסומנות ככושלות."""
    conn.execute(
        """UPDATE ingest_runs SET status = 'failed', finished_at = now(), error = 'הריצה נקטעה'
           WHERE status = 'running'"""
    )
    conn.execute(
        """UPDATE ingest_requests SET status = 'failed', finished_at = now(),
               message = 'הבקשה נקטעה' WHERE status = 'running'"""
    )


def loaded_file_names(conn, chain: Chain) -> set[str]:
    """שמות הקבצים שכבר נטענו, בלי סיומת."""
    rows = conn.execute(
        "SELECT file_name FROM ingest_files WHERE chain_key = %s", (chain.key,)
    ).fetchall()
    return {stem(r[0]) for r in rows}


def stem(file_name: str) -> str:
    name = file_name.rsplit("/", 1)[-1]
    for ext in (".xml", ".gz", ".zip"):
        while name.lower().endswith(ext):
            name = name[: -len(ext)]
    return name


def _record_file(cur, file_name, chain_key, store_id, file_type, file_time, rows):
    cur.execute(
        """INSERT INTO ingest_files (file_name, chain_key, store_id, file_type, file_time, rows)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (file_name) DO UPDATE
           SET rows = EXCLUDED.rows, loaded_at = now()""",
        (stem(file_name), chain_key, store_id, file_type, file_time, rows),
    )


# ---------- סניפים ----------

def load_stores(conn, chain: Chain, file_name: str, file_time: datetime, fallback_chain_id: str,
                rows: list[dict]) -> int:
    """טעינת רשימת סניפים. כתובת שהשתנתה מאפסת את ה-geocoding כדי שיחושב מחדש."""
    if not rows:
        raise EmptyFile("קובץ סניפים ריק")
    changed = "(stores.address, stores.city) IS DISTINCT FROM (EXCLUDED.address, EXCLUDED.city)"
    with conn.transaction(), conn.cursor() as cur:
        for r in rows:
            cur.execute(
                f"""INSERT INTO stores (chain_key, chain_id, store_id, sub_chain_id, sub_chain_name,
                                        name, address, city, zip_code, store_type)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (chain_key, chain_id, store_id) DO UPDATE
                    SET sub_chain_id = EXCLUDED.sub_chain_id,
                        sub_chain_name = EXCLUDED.sub_chain_name,
                        name = EXCLUDED.name,
                        lat = CASE WHEN {changed} THEN NULL ELSE stores.lat END,
                        lng = CASE WHEN {changed} THEN NULL ELSE stores.lng END,
                        geocode_precision = CASE WHEN {changed} THEN NULL
                                                 ELSE stores.geocode_precision END,
                        geocoded_at = CASE WHEN {changed} THEN NULL ELSE stores.geocoded_at END,
                        address = EXCLUDED.address, city = EXCLUDED.city,
                        zip_code = EXCLUDED.zip_code, store_type = EXCLUDED.store_type,
                        updated_at = now()""",
                (chain.key, r["chain_id"] or fallback_chain_id, r["store_id"], r["sub_chain_id"],
                 r["sub_chain_name"], r["name"], r["address"], r["city"], r["zip_code"],
                 r["store_type"]),
            )
        _record_file(cur, file_name, chain.key, None, "STORE_FILE", file_time, len(rows))
    return len(rows)


def store_ids_in_radius(conn, chain: Chain, address_id: Optional[int] = None) -> list[str]:
    """מספרי הסניפים של הרשת שנמצאים ברדיוס של כתובת שמורה כלשהי (או של כתובת מסוימת)."""
    rows = conn.execute(
        """SELECT DISTINCT s.store_id
           FROM stores s JOIN addresses a
             ON a.lat IS NOT NULL AND s.lat IS NOT NULL
            AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km
           WHERE s.chain_key = %s AND (%s::int IS NULL OR a.id = %s)""",
        (chain.key, address_id, address_id),
    ).fetchall()
    return sorted((r[0] for r in rows), key=lambda x: (len(x), x))


# ---------- מחירים ----------

_PRICE_COLUMNS = (
    "barcode", "internal_chain", "name", "manufacturer", "unit_qty", "quantity",
    "unit_of_measure", "is_weighted", "price", "unit_price", "allow_discount",
    "price_update_time",
)


def _find_or_create_store(cur, chain: Chain, chain_id: str, store_id: str):
    """מחזיר (id, prices_file_time) של הסניף. מזהה הרשת בקובץ המחירים לא תמיד זהה לזה
    שבקובץ הסניפים, ולכן אם אין התאמה מדויקת ויש סניף יחיד במספר הזה – משתמשים בו."""
    cur.execute(
        """SELECT id, prices_file_time, chain_id FROM stores
           WHERE chain_key = %s AND store_id = %s""",
        (chain.key, store_id),
    )
    matches = cur.fetchall()
    exact = [m for m in matches if m[2] == chain_id]
    if exact:
        return exact[0][:2]
    if len(matches) == 1:
        return matches[0][:2]
    cur.execute(
        """INSERT INTO stores (chain_key, chain_id, store_id) VALUES (%s, %s, %s)
           RETURNING id, prices_file_time""",
        (chain.key, chain_id, store_id),
    )
    return cur.fetchone()


def load_price_full(conn, chain: Chain, chain_id: str, store_id: str, file_name: str,
                    file_time: datetime, rows: list[dict]) -> int:
    """טעינת קובץ PriceFull: מחליף את כל מחירי הסניף בתמונת המצב החדשה."""
    if not rows:
        raise EmptyFile("קובץ מחירים ריק")
    with conn.transaction(), conn.cursor() as cur:
        store_pk, current_time = _find_or_create_store(cur, chain, chain_id, store_id)
        cur.execute("SELECT %s::timestamptz", (file_time,))
        if current_time is not None and current_time > cur.fetchone()[0]:
            # כבר נטען קובץ חדש יותר לסניף הזה
            _record_file(cur, file_name, chain.key, store_id, "PRICE_FULL_FILE", file_time, 0)
            return 0

        cur.execute(
            """CREATE TEMP TABLE tmp_prices (
                   barcode text, internal_chain text, name text, manufacturer text,
                   unit_qty text, quantity numeric, unit_of_measure text, is_weighted boolean,
                   price numeric, unit_price numeric, allow_discount boolean,
                   price_update_time timestamptz
               ) ON COMMIT DROP"""
        )
        with cur.copy(f"COPY tmp_prices ({', '.join(_PRICE_COLUMNS)}) FROM STDIN") as copy:
            for r in rows:
                copy.write_row([r[c] for c in _PRICE_COLUMNS])

        cur.execute(
            """INSERT INTO products (barcode, internal_chain, name, manufacturer, unit_qty,
                                     quantity, unit_of_measure, is_weighted)
               SELECT DISTINCT ON (barcode, internal_chain)
                      barcode, internal_chain, name, manufacturer, unit_qty, quantity,
                      unit_of_measure, is_weighted
               FROM tmp_prices
               ORDER BY barcode, internal_chain
               ON CONFLICT (barcode, internal_chain) DO UPDATE
               SET name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
                   unit_qty = EXCLUDED.unit_qty, quantity = EXCLUDED.quantity,
                   unit_of_measure = EXCLUDED.unit_of_measure,
                   is_weighted = EXCLUDED.is_weighted, updated_at = now()
               -- ברקוד משותף לכמה רשתות: שומרים את התיאור הראשון ולא מחליפים בכל טעינה
               WHERE products.internal_chain <> ''
                 AND (products.name, products.is_weighted) IS DISTINCT FROM
                     (EXCLUDED.name, EXCLUDED.is_weighted)"""
        )
        cur.execute("DELETE FROM prices WHERE store_pk = %s", (store_pk,))
        cur.execute(
            """INSERT INTO prices (store_pk, product_id, price, unit_price, is_weighted,
                                   allow_discount, price_update_time, file_time)
               SELECT DISTINCT ON (p.id)
                      %s, p.id, t.price, t.unit_price, t.is_weighted, t.allow_discount,
                      t.price_update_time, %s
               FROM tmp_prices t
               JOIN products p USING (barcode, internal_chain)
               ORDER BY p.id, t.price_update_time DESC NULLS LAST""",
            (store_pk, file_time),
        )
        loaded = cur.rowcount
        cur.execute(
            "UPDATE stores SET prices_file_time = %s, prices_loaded_at = now() WHERE id = %s",
            (file_time, store_pk),
        )
        _record_file(cur, file_name, chain.key, store_id, "PRICE_FULL_FILE", file_time, loaded)
    return loaded
