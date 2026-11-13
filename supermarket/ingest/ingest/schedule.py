"""הריצה הלילית: פעם ביום, בשעה קבועה לפי שעון ישראל (ברירת מחדל 06:00).

המועד נבדק מול התאריך של הריצה האחרונה (נשמר ב-app_settings), כך ש:
- אין ריצה כפולה באותו יום, גם אם ה-worker הופעל מחדש;
- אם השרת היה כבוי ב-06:00, הריצה מתבצעת כשהוא עולה.
"""
from __future__ import annotations

from datetime import date, datetime, time
from typing import Optional
from zoneinfo import ZoneInfo

ISRAEL = ZoneInfo("Asia/Jerusalem")
_KEY = "last_nightly_run"


def parse_time(text: str) -> time:
    hour, _, minute = text.strip().partition(":")
    return time(int(hour), int(minute or 0))


def now_in_israel() -> datetime:
    return datetime.now(ISRAEL)


def nightly_due(now: datetime, last_run: Optional[date], at: time) -> bool:
    """now: הזמן הנוכחי בשעון ישראל. last_run: התאריך (בישראל) של הריצה הלילית האחרונה."""
    if now.time() < at:
        return False
    return last_run is None or last_run < now.date()


def last_run(conn) -> Optional[date]:
    row = conn.execute("SELECT value FROM app_settings WHERE key = %s", (_KEY,)).fetchone()
    try:
        return date.fromisoformat(row[0]) if row else None
    except ValueError:
        return None


def mark_run(conn, day: date) -> None:
    conn.execute(
        """INSERT INTO app_settings (key, value) VALUES (%s, %s)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value""",
        (_KEY, day.isoformat()),
    )
