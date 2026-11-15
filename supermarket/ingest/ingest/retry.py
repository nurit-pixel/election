"""ניסיון חוזר אוטומטי לרשת שהטעינה שלה נכשלה: שעה אחרי הכשל, עד שלושה ניסיונות נוספים ביום.

רשת שנכשלה בריצה הלילית (האתר לא ענה, קובץ פגום) לא מחכה ללילה הבא. ניסיון חוזר טוען רק את הסניפים
שעוד אין להם מחירים עדכניים, כך שהוא קצר."""
from __future__ import annotations

import logging
from dataclasses import dataclass
from datetime import datetime, timedelta

from . import schedule

log = logging.getLogger("ingest.retry")

RETRY_AFTER = timedelta(hours=1)
# הריצה הלילית ועוד שלושה ניסיונות חוזרים
MAX_RUNS_PER_DAY = 4
# סוגי הריצה שמנסים שוב, ובקשת ה-worker לכל אחד (המבצעים נטענים יחד עם המחירים)
RETRY_KINDS = {"prices": "retry_prices", "stores": "retry_stores"}


@dataclass(frozen=True)
class LastRun:
    chain_key: str
    kind: str
    status: str
    finished_at: datetime | None
    runs_today: int


def due(run: LastRun, now: datetime) -> bool:
    """האם לנסות שוב את הרשת: הריצה האחרונה נכשלה (או נטענה רק בחלקה) לפני שעה לפחות,
    ועוד לא מוצו הניסיונות להיום."""
    return (
        run.kind in RETRY_KINDS
        and run.status in ("failed", "partial")
        and run.finished_at is not None
        and now - run.finished_at >= RETRY_AFTER
        and run.runs_today < MAX_RUNS_PER_DAY
    )


def last_runs(conn) -> list[LastRun]:
    """הריצה האחרונה של כל רשת וסוג, ומספר הריצות מאז חצות (שעון ישראל)."""
    midnight = schedule.now_in_israel().replace(hour=0, minute=0, second=0, microsecond=0)
    rows = conn.execute(
        """SELECT DISTINCT ON (r.chain_key, r.kind) r.chain_key, r.kind, r.status, r.finished_at,
                  (SELECT count(*) FROM ingest_runs t
                   WHERE t.chain_key = r.chain_key AND t.kind = r.kind AND t.started_at >= %s) AS runs_today
           FROM ingest_runs r
           WHERE r.kind = ANY(%s) AND r.started_at >= %s
           ORDER BY r.chain_key, r.kind, r.id DESC""",
        (midnight, list(RETRY_KINDS), midnight - timedelta(days=1)),
    ).fetchall()
    return [LastRun(*row) for row in rows]


def schedule_retries(conn, enqueue) -> int:
    """מכניס לתור ניסיון חוזר לכל רשת שהגיע זמנה. מחזיר כמה נכנסו."""
    now = datetime.now(tz=schedule.ISRAEL)
    queued = 0
    for run in last_runs(conn):
        if due(run, now):
            if enqueue(conn, RETRY_KINDS[run.kind], chain_key=run.chain_key):
                queued += 1
                log.info("ניסיון חוזר ל-%s (%s), ניסיון %d היום", run.chain_key, run.kind, run.runs_today + 1)
    return queued
