"""גישה למסד הנתונים וטעינת קבצים. כל קובץ נטען בטרנזקציה אחת:
אם הטעינה נכשלת, המחירים הקודמים של הסניף נשארים כמו שהם."""
from __future__ import annotations

import glob
import os
from datetime import datetime

import psycopg

from .chains import Chain


def connect(database_url: str) -> psycopg.Connection:
    # הזמנים בקבצים הם שעון ישראל בלי אזור זמן
    # autocommit: כל פקודה בודדת נשמרת מיד, ו-conn.transaction() פותח טרנזקציה אמיתית
    return psycopg.connect(database_url, autocommit=True, options="-c TimeZone=Asia/Jerusalem")


def apply_schema(conn: psycopg.Connection, schema_dir: str) -> None:
    for path in sorted(glob.glob(os.path.join(schema_dir, "*.sql"))):
        with open(path, encoding="utf-8") as f:
            conn.execute(f.read())


def upsert_chain(conn: psycopg.Connection, chain: Chain) -> None:
    conn.execute(
        """INSERT INTO chains (chain_id, scraper_name, name, is_pharm)
           VALUES (%s, %s, %s, %s)
           ON CONFLICT (chain_id) DO UPDATE
           SET scraper_name = EXCLUDED.scraper_name, name = EXCLUDED.name,
               is_pharm = EXCLUDED.is_pharm""",
        (chain.chain_id, chain.key, chain.name, chain.is_pharm),
    )


def start_run(conn: psycopg.Connection, chain: Chain) -> int:
    run_id = conn.execute(
        "INSERT INTO ingest_runs (chain_id) VALUES (%s) RETURNING id", (chain.chain_id,)
    ).fetchone()[0]
    return run_id


def finish_run(conn, run_id: int, status: str, loaded: int, failed: int, rows: int, error: str | None):
    conn.execute(
        """UPDATE ingest_runs SET finished_at = now(), status = %s, files_loaded = %s,
               files_failed = %s, rows_loaded = %s, error = %s WHERE id = %s""",
        (status, loaded, failed, rows, error, run_id),
    )


def has_loaded_files(conn: psycopg.Connection, chain: Chain) -> bool:
    return conn.execute(
        "SELECT 1 FROM ingest_files WHERE chain_id = %s LIMIT 1", (chain.chain_id,)
    ).fetchone() is not None


def is_file_loaded(conn: psycopg.Connection, file_name: str) -> bool:
    return conn.execute(
        "SELECT 1 FROM ingest_files WHERE file_name = %s", (file_name,)
    ).fetchone() is not None


def _record_file(cur, file_name, chain_id, store_id, file_type, file_time, rows):
    cur.execute(
        """INSERT INTO ingest_files (file_name, chain_id, store_id, file_type, file_time, rows)
           VALUES (%s, %s, %s, %s, %s, %s)
           ON CONFLICT (file_name) DO UPDATE
           SET rows = EXCLUDED.rows, loaded_at = now()""",
        (file_name, chain_id, store_id, file_type, file_time, rows),
    )


def load_stores(conn, chain: Chain, file_name: str, file_time: datetime, rows: list[dict]) -> int:
    """טעינת רשימת סניפים. סניפים קיימים מתעדכנים; קואורדינטות נשמרות אם הכתובת לא השתנתה."""
    with conn.transaction(), conn.cursor() as cur:
        for r in rows:
            cur.execute(
                """INSERT INTO stores (chain_id, store_id, sub_chain_id, sub_chain_name, name,
                                       address, city, zip_code, store_type)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   ON CONFLICT (chain_id, store_id) DO UPDATE
                   SET sub_chain_id = EXCLUDED.sub_chain_id,
                       sub_chain_name = EXCLUDED.sub_chain_name,
                       name = EXCLUDED.name,
                       -- כתובת שהשתנתה מאפסת את ה-geocoding כדי שיחושב מחדש
                       lat = CASE WHEN (stores.address, stores.city) IS DISTINCT FROM
                                       (EXCLUDED.address, EXCLUDED.city) THEN NULL ELSE stores.lat END,
                       lng = CASE WHEN (stores.address, stores.city) IS DISTINCT FROM
                                       (EXCLUDED.address, EXCLUDED.city) THEN NULL ELSE stores.lng END,
                       geocoded_at = CASE WHEN (stores.address, stores.city) IS DISTINCT FROM
                                       (EXCLUDED.address, EXCLUDED.city) THEN NULL ELSE stores.geocoded_at END,
                       address = EXCLUDED.address, city = EXCLUDED.city,
                       zip_code = EXCLUDED.zip_code, store_type = EXCLUDED.store_type,
                       updated_at = now()""",
                (chain.chain_id, r["store_id"], r["sub_chain_id"], r["sub_chain_name"], r["name"],
                 r["address"], r["city"], r["zip_code"], r["store_type"]),
            )
        _record_file(cur, file_name, chain.chain_id, None, "STORE_FILE", file_time, len(rows))
    return len(rows)


_PRICE_COLUMNS = (
    "barcode", "internal_chain_id", "name", "manufacturer", "unit_qty", "quantity",
    "unit_of_measure", "is_weighted", "price", "unit_price", "allow_discount",
    "price_update_time",
)


def load_price_full(conn, chain: Chain, store_id: str, file_name: str,
                    file_time: datetime, rows: list[dict]) -> int:
    """טעינת קובץ PriceFull: מחליף את כל מחירי הסניף בתמונת המצב החדשה."""
    if not rows:
        raise ValueError("קובץ מחירים ריק")
    with conn.transaction(), conn.cursor() as cur:
        cur.execute(
            """INSERT INTO stores (chain_id, store_id) VALUES (%s, %s)
               ON CONFLICT (chain_id, store_id) DO UPDATE SET chain_id = EXCLUDED.chain_id
               RETURNING id, prices_file_time""",
            (chain.chain_id, store_id),
        )
        store_pk, current_time = cur.fetchone()
        cur.execute("SELECT %s::timestamptz", (file_time,))
        file_time_tz = cur.fetchone()[0]
        if current_time is not None and current_time > file_time_tz:
            # כבר נטען קובץ חדש יותר לסניף הזה
            _record_file(cur, file_name, chain.chain_id, store_id, "PRICE_FULL_FILE", file_time, 0)
            return 0

        cur.execute(
            """CREATE TEMP TABLE tmp_prices (
                   barcode text, internal_chain_id text, name text, manufacturer text,
                   unit_qty text, quantity numeric, unit_of_measure text, is_weighted boolean,
                   price numeric, unit_price numeric, allow_discount boolean,
                   price_update_time timestamptz
               ) ON COMMIT DROP"""
        )
        with cur.copy(f"COPY tmp_prices ({', '.join(_PRICE_COLUMNS)}) FROM STDIN") as copy:
            for r in rows:
                copy.write_row([r[c] for c in _PRICE_COLUMNS])

        cur.execute(
            """INSERT INTO products (barcode, internal_chain_id, name, manufacturer, unit_qty,
                                     quantity, unit_of_measure, is_weighted)
               SELECT DISTINCT ON (barcode, internal_chain_id)
                      barcode, internal_chain_id, name, manufacturer, unit_qty, quantity,
                      unit_of_measure, is_weighted
               FROM tmp_prices
               ORDER BY barcode, internal_chain_id
               ON CONFLICT (barcode, internal_chain_id) DO UPDATE
               SET name = EXCLUDED.name, manufacturer = EXCLUDED.manufacturer,
                   unit_qty = EXCLUDED.unit_qty, quantity = EXCLUDED.quantity,
                   unit_of_measure = EXCLUDED.unit_of_measure,
                   is_weighted = EXCLUDED.is_weighted, updated_at = now()
               -- ברקוד משותף לכמה רשתות: שומרים את התיאור הראשון ולא מחליפים בכל טעינה
               WHERE products.internal_chain_id <> ''
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
               JOIN products p USING (barcode, internal_chain_id)
               ORDER BY p.id, t.price_update_time DESC NULLS LAST""",
            (store_pk, file_time),
        )
        loaded = cur.rowcount
        cur.execute(
            "UPDATE stores SET prices_file_time = %s, prices_loaded_at = now() WHERE id = %s",
            (file_time, store_pk),
        )
        _record_file(cur, file_name, chain.chain_id, store_id, "PRICE_FULL_FILE", file_time, loaded)
    return loaded
