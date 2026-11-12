"""תהליך רקע: מטפל בבקשות מהאפליקציה (טבלת ingest_requests) וב-geocoding של סניפים.

- הוספת כתובת באפליקציה יוצרת בקשת "address": geocoding לכתובת וטעינה מיידית של הסניפים שלידה.
- כשאין בקשות, ה-worker מתקדם ב-geocoding של סניפים במנות קטנות, כך שבקשה חדשה לא ממתינה.
- הריצה הלילית תתווסף בשלב 7.
"""
from __future__ import annotations

import logging
import traceback

from . import db, geocode
from .chains import CHAINS
from .config import Config

log = logging.getLogger("ingest.worker")
GEOCODE_BATCH = 15
IDLE_WAIT_SECONDS = 30


def enqueue(conn, kind: str, address_id: int | None = None) -> None:
    conn.execute(
        """INSERT INTO ingest_requests (kind, address_id)
           SELECT %s, %s WHERE NOT EXISTS (
               SELECT 1 FROM ingest_requests
               WHERE kind = %s AND address_id IS NOT DISTINCT FROM %s AND status = 'pending')""",
        (kind, address_id, kind, address_id),
    )
    conn.execute("NOTIFY ingest")


def handle(cfg: Config, conn, kind: str, address_id: int | None) -> str:
    from . import pipeline  # ייבוא מאוחר: הספריות כבדות

    chains = list(CHAINS.values())
    if kind == "stores":
        statuses = pipeline.refresh_stores(cfg, conn, chains)
        ok = sum(s in ("ok", "partial") for s in statuses.values())
        return f"רשימות סניפים: {ok} מתוך {len(statuses)} רשתות"
    if kind == "address":
        geocode.geocode_addresses(cfg, conn)
        row = conn.execute("SELECT lat FROM addresses WHERE id = %s", (address_id,)).fetchone()
        if row is None:
            return "הכתובת נמחקה"
        if row[0] is None:
            return "הכתובת לא נמצאה ב-geocoding"
        statuses = pipeline.refresh_prices(cfg, conn, chains, address_id=address_id,
                                           all_stores=False)
        return f"מחירים נטענו ל-{len(statuses)} רשתות ליד הכתובת"
    if kind == "prices":
        geocode.geocode_addresses(cfg, conn)
        statuses = pipeline.refresh_prices(cfg, conn, chains, all_stores=cfg.ingest_all_stores)
        ok = sum(s in ("ok", "partial") for s in statuses.values())
        return f"מחירים: {ok} מתוך {len(statuses)} רשתות"
    raise ValueError(f"סוג בקשה לא מוכר: {kind}")


def run(cfg: Config) -> None:
    with db.connect(cfg.database_url) as conn:
        db.apply_schema(conn, cfg.schema_dir)
        db.close_stale_runs(conn)
        if conn.execute("SELECT count(*) FROM stores").fetchone()[0] == 0:
            enqueue(conn, "stores")      # הפעלה ראשונה: רשימת סניפים ארצית
        conn.execute("LISTEN ingest")
        log.info("ה-worker פעיל")
        geocoding_active = False
        while True:
            request = conn.execute(
                """UPDATE ingest_requests SET status = 'running', started_at = now()
                   WHERE id = (SELECT id FROM ingest_requests WHERE status = 'pending'
                               ORDER BY (kind = 'address') DESC, id LIMIT 1)
                   RETURNING id, kind, address_id"""
            ).fetchone()
            if request:
                request_id, kind, address_id = request
                log.info("בקשה %d: %s", request_id, kind)
                try:
                    status, message = "done", handle(cfg, conn, kind, address_id)
                except Exception as exc:  # pylint: disable=broad-exception-caught
                    status, message = "failed", f"{type(exc).__name__}: {exc}"
                    log.error("בקשה %d נכשלה\n%s", request_id, traceback.format_exc())
                conn.execute(
                    """UPDATE ingest_requests SET status = %s, finished_at = now(), message = %s
                       WHERE id = %s""",
                    (status, message[:1000], request_id),
                )
                log.info("בקשה %d: %s – %s", request_id, status, message)
                continue

            try:
                done = geocode.geocode_stores(cfg, conn, GEOCODE_BATCH)
            except Exception as exc:  # pylint: disable=broad-exception-caught
                log.warning("geocoding נכשל זמנית: %s", exc)
                done = 0
                geocoding_active = False
                _wait(conn)
                continue
            if done:
                geocoding_active = True
                remaining = conn.execute(
                    "SELECT count(*) FROM stores WHERE geocoded_at IS NULL").fetchone()[0]
                log.info("geocoding: נותרו %d סניפים", remaining)
                continue
            if geocoding_active:
                # הסתיים סבב geocoding: ייתכן שסניפים חדשים נכנסו לרדיוס של כתובת שמורה
                geocoding_active = False
                if conn.execute("SELECT 1 FROM addresses WHERE lat IS NOT NULL LIMIT 1").fetchone():
                    enqueue(conn, "prices")
                continue
            _wait(conn)


def _wait(conn) -> None:
    for _ in conn.notifies(timeout=IDLE_WAIT_SECONDS, stop_after=1):
        pass
