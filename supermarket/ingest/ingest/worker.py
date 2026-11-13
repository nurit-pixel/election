"""תהליך רקע: מטפל בבקשות מהאפליקציה (טבלת ingest_requests) וב-geocoding של סניפים.

- הוספת כתובת באפליקציה יוצרת בקשת "address": geocoding לכתובת וטעינה מיידית של הסניפים שלידה.
- כשאין בקשות, ה-worker מתקדם ב-geocoding של סניפים במנות קטנות, כך שבקשה חדשה לא ממתינה.
- ריצה לילית בשעה קבועה לפי שעון ישראל (schedule.py): רשימות סניפים, מחירים ומבצעים,
  היסטוריה והתראות, והמייל היומי המרוכז.
"""
from __future__ import annotations

import logging
import time
import traceback

from . import db, geocode, schedule, tracking
from .chains import CHAINS
from .config import Config

log = logging.getLogger("ingest.worker")
GEOCODE_BATCH = 15
# בקשת כתובת: טוענים רק סניפים שהמחירים שלהם חסרים או ישנים מזה, ועם מגבלת זמן קצרה לרשת
ADDRESS_MISSING_HOURS = 24
ADDRESS_CHAIN_TIMEOUT_SECONDS = 15 * 60
IDLE_WAIT_SECONDS = 30
PRICES_DURING_GEOCODE_SECONDS = 20 * 60
GEOCODE_BACKOFF_SECONDS = (300, 900, 1800, 3600)   # המתנה אחרי כשל (למשל 429 משירות ה-geocoding)


def enqueue(conn, kind: str, address_id: int | None = None) -> None:
    conn.execute(
        """INSERT INTO ingest_requests (kind, address_id)
           SELECT %s, %s WHERE NOT EXISTS (
               SELECT 1 FROM ingest_requests
               WHERE kind = %s AND address_id IS NOT DISTINCT FROM %s AND status = 'pending')""",
        (kind, address_id, kind, address_id),
    )
    conn.execute("NOTIFY ingest")


def handle(cfg: Config, conn, kind: str, address_id: int | None,
           request_id: int | None = None) -> str:
    chains = list(CHAINS.values())
    # ההתקדמות נכתבת לבקשה עצמה, ומוצגת במסך ההגדרות. חיבור נפרד, כי היא מדווחת מ-thread אחר
    progress_conn = db.connect(cfg.database_url) if request_id is not None else None

    def progress(done: int, total: int, chain_name: str) -> None:
        if progress_conn is not None:
            progress_conn.execute("UPDATE ingest_requests SET message = %s WHERE id = %s",
                                  (f"{done} מתוך {total} רשתות נטענו (אחרונה: {chain_name})", request_id))

    try:
        return _handle(cfg, conn, kind, address_id, chains, progress)
    finally:
        if progress_conn is not None:
            progress_conn.close()


def _handle(cfg: Config, conn, kind: str, address_id: int | None, chains, progress) -> str:
    from . import pipeline  # pylint: disable=import-outside-toplevel

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
        # רק סניפים שעוד אין להם מחירים עדכניים: באזור שכבר נטען (למשל בשביל משתמש אחר)
        # אין מה להוריד והבקשה מסתיימת מיד. רשת שנתקעת לא מעכבת את התור יותר מרבע שעה.
        statuses = pipeline.refresh_prices(cfg, conn, chains, address_id=address_id,
                                           all_stores=False,
                                           missing_hours=ADDRESS_MISSING_HOURS,
                                           timeout=ADDRESS_CHAIN_TIMEOUT_SECONDS,
                                           progress=progress)
        if not statuses:
            return "לכל הסניפים שליד הכתובת כבר יש מחירים עדכניים"
        tracking.update(conn, cfg)
        return f"מחירים נטענו ל-{len(statuses)} רשתות ליד הכתובת"
    if kind == "prices":
        geocode.geocode_addresses(cfg, conn)
        statuses = pipeline.refresh_prices(cfg, conn, chains, all_stores=cfg.ingest_all_stores,
                                           progress=progress)
        ok = sum(s in ("ok", "partial") for s in statuses.values())
        _, created = tracking.update(conn, cfg)
        return f"מחירים: {ok} מתוך {len(statuses)} רשתות, {created} התראות חדשות"
    if kind == "nightly":
        return nightly(cfg, conn)
    if kind == "track":
        # מוצר נוסף למעקב או לרשימה: שומרים מיד את המחיר הנוכחי שלו
        tracking.update(conn, cfg)
        return "היסטוריית המחירים עודכנה"
    raise ValueError(f"סוג בקשה לא מוכר: {kind}")


def nightly(cfg: Config, conn) -> str:
    """הריצה הלילית. כשל ברשת אחת (או בשלב אחד) אינו עוצר את השאר."""
    from . import pipeline

    chains = list(CHAINS.values())
    parts: list[str] = []

    def step(name: str, action) -> None:
        try:
            parts.append(f"{name}: {action()}")
        except Exception as exc:  # pylint: disable=broad-exception-caught
            parts.append(f"{name}: נכשל ({type(exc).__name__}: {exc})")
            log.error("ריצה לילית – השלב %s נכשל\n%s", name, traceback.format_exc())

    def stores() -> str:
        statuses = pipeline.refresh_stores(cfg, conn, chains)
        return f"{sum(s != 'failed' for s in statuses.values())}/{len(statuses)} רשתות"

    def prices() -> str:
        geocode.geocode_addresses(cfg, conn)
        statuses = pipeline.refresh_prices(cfg, conn, chains, all_stores=cfg.ingest_all_stores)
        return f"{sum(s != 'failed' for s in statuses.values())}/{len(statuses)} רשתות"

    step("סניפים", stores)
    step("מחירים ומבצעים", prices)
    step("התראות חדשות", lambda: tracking.update(conn, cfg)[1])
    step("מייל", lambda: f"{tracking.send_digest(conn, cfg)} התראות נשלחו")
    step("ניקוי", lambda: db.prune(conn, cfg.retention_days) or "בוצע")
    return " · ".join(parts)


def _schedule_nightly(cfg: Config, conn) -> None:
    now = schedule.now_in_israel()
    if schedule.nightly_due(now, schedule.last_run(conn), schedule.parse_time(cfg.nightly_time)):
        # מסמנים לפני הריצה: ריצה שנקטעה לא תתחיל שוב ושוב באותו יום
        schedule.mark_run(conn, now.date())
        enqueue(conn, "nightly")
        log.info("ריצה לילית נכנסה לתור (%s)", now.strftime("%d.%m %H:%M"))


def run(cfg: Config) -> None:
    with db.connect(cfg.database_url) as conn:
        db.apply_schema(conn, cfg.schema_dir)
        db.close_stale_runs(conn)
        nightly_pending = schedule.nightly_due(
            schedule.now_in_israel(), schedule.last_run(conn), schedule.parse_time(cfg.nightly_time))
        if conn.execute("SELECT count(*) FROM stores").fetchone()[0] == 0 and not nightly_pending:
            # הפעלה ראשונה לפני שעת הריצה הלילית: רשימת סניפים ארצית.
            # אם הריצה הלילית עומדת להתחיל ממילא, היא כוללת את רשימות הסניפים.
            enqueue(conn, "stores")
        conn.execute("LISTEN ingest")
        log.info("ה-worker פעיל")
        geocoding_active = False
        geocode_failures = 0
        geocode_resume_at = 0.0
        next_prices_at = 0.0
        while True:
            _schedule_nightly(cfg, conn)
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
                    status, message = "done", handle(cfg, conn, kind, address_id, request_id)
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

            if time.monotonic() < geocode_resume_at:
                _wait(conn)
                continue
            try:
                done = geocode.geocode_stores(cfg, conn, GEOCODE_BATCH)
                geocode_failures = 0
            except Exception as exc:  # pylint: disable=broad-exception-caught
                pause = GEOCODE_BACKOFF_SECONDS[min(geocode_failures, len(GEOCODE_BACKOFF_SECONDS) - 1)]
                geocode_failures += 1
                geocode_resume_at = time.monotonic() + pause
                log.warning("geocoding נכשל, ניסיון נוסף בעוד %d דקות: %s", pause // 60,
                            str(exc)[:120])
                continue
            if done:
                geocoding_active = True
                remaining = conn.execute(
                    "SELECT count(*) FROM stores WHERE geocoded_at IS NULL").fetchone()[0]
                log.info("geocoding: נותרו %d סניפים", remaining)
                # תוך כדי האיתור: אם נכנסו לרדיוס סניפים שעוד אין להם מחירים, טוענים אותם
                # בלי לחכות לסוף הסבב (לכל היותר פעם ב-PRICES_DURING_GEOCODE_SECONDS)
                if time.monotonic() >= next_prices_at and conn.execute(
                    """SELECT 1 FROM stores s JOIN addresses a
                         ON a.lat IS NOT NULL AND s.lat IS NOT NULL
                        AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km
                       WHERE s.prices_file_time IS NULL LIMIT 1"""
                ).fetchone():
                    next_prices_at = time.monotonic() + PRICES_DURING_GEOCODE_SECONDS
                    enqueue(conn, "prices")
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
