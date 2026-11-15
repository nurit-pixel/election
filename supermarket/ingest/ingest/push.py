"""התראות לטלפון (Web Push) על התראות מחיר חדשות. מפתחות ה-VAPID נוצרים באפליקציה (web/lib/push.ts)
ונשמרים ב-app_settings; כל עוד אין אף מנוי, אין מה לשלוח."""
from __future__ import annotations

import json
import logging

from .tracking import Alert, alert_line

log = logging.getLogger(__name__)

# התראות ישנות מזה לא נשלחות (למשל למשתמש שהפעיל התראות רק עכשיו)
MAX_AGE_HOURS = 24


def build_payload(alerts: list[Alert], app_url: str = "") -> dict:
    """הודעה אחת לכל משתמש: הכותרת לפי מספר ההתראות, והגוף עם עד שלוש מהן."""
    title = "התראת מחיר" if len(alerts) == 1 else f"{len(alerts)} התראות מחיר חדשות"
    lines = [alert_line(a) for a in alerts[:3]]
    if len(alerts) > 3:
        lines.append(f"ועוד {len(alerts) - 3}")
    return {"title": title, "body": "\n".join(lines), "url": f"{app_url.rstrip('/')}/alerts" if app_url else "/alerts"}


def send_pending(conn, app_url: str = "") -> int:
    """שולח לכל משתמש עם מנוי הודעה על ההתראות החדשות שלו. מחזיר כמה הודעות נשלחו."""
    keys = dict(conn.execute(
        "SELECT key, value FROM app_settings WHERE key IN ('vapid_private', 'vapid_subject')").fetchall())
    users = conn.execute(
        """SELECT DISTINCT a.user_id FROM alerts a
           WHERE a.pushed_at IS NULL AND a.user_id IS NOT NULL
             AND a.created_at > now() - make_interval(hours => %s)""",
        (MAX_AGE_HOURS,),
    ).fetchall()
    if not users:
        return 0
    sent = 0
    for (user_id,) in users:
        rows = conn.execute(
            """SELECT a.id, p.name, c.name, s.name, a.kind, a.old_price, a.new_price, a.pct, a.target_price
               FROM alerts a
               JOIN products p ON p.id = a.product_id
               JOIN chains c ON c.key = a.chain_key
               LEFT JOIN stores s ON s.id = a.store_pk
               WHERE a.user_id = %s AND a.pushed_at IS NULL
                 AND a.created_at > now() - make_interval(hours => %s)
               ORDER BY a.kind DESC, a.pct NULLS LAST, p.name""",
            (user_id, MAX_AGE_HOURS),
        ).fetchall()
        subscriptions = conn.execute(
            "SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = %s", (user_id,)
        ).fetchall()
        if subscriptions and keys.get("vapid_private"):
            payload = json.dumps(build_payload([Alert(*r[1:]) for r in rows], app_url), ensure_ascii=False)
            for sub_id, endpoint, p256dh, auth in subscriptions:
                sent += _send(conn, keys, sub_id, endpoint, p256dh, auth, payload)
        # גם בלי מנוי: מסמנים, כדי שהתראות ישנות לא יישלחו כשמישהו יפעיל התראות בעתיד
        conn.execute("UPDATE alerts SET pushed_at = now() WHERE id = ANY(%s)", ([r[0] for r in rows],))
    if sent:
        log.info("נשלחו %d התראות לטלפון", sent)
    return sent


def _send(conn, keys: dict, sub_id: int, endpoint: str, p256dh: str, auth: str, payload: str) -> int:
    from pywebpush import WebPushException, webpush  # pylint: disable=import-outside-toplevel
    from py_vapid import Vapid02  # pylint: disable=import-outside-toplevel

    try:
        webpush(
            subscription_info={"endpoint": endpoint, "keys": {"p256dh": p256dh, "auth": auth}},
            data=payload,
            vapid_private_key=Vapid02.from_string(keys["vapid_private"]),
            vapid_claims={"sub": keys.get("vapid_subject") or "mailto:admin@localhost"},
            ttl=12 * 60 * 60,
            timeout=15,
        )
        return 1
    except WebPushException as exc:
        status = getattr(exc.response, "status_code", None)
        if status in (404, 410):  # המנוי בוטל בדפדפן
            conn.execute("DELETE FROM push_subscriptions WHERE id = %s", (sub_id,))
        else:
            log.warning("שליחת התראה לטלפון נכשלה (%s): %s", status, str(exc)[:200])
    except Exception as exc:  # pylint: disable=broad-exception-caught
        log.warning("שליחת התראה לטלפון נכשלה: %s", str(exc)[:200])
    return 0
