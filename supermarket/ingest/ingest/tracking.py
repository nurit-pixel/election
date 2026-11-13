"""מעקב מחירים: היסטוריה יומית, התראות ומייל יומי מרוכז.

- price_history נשמר רק למוצרים במעקב ולמוצרים שברשימות שמורות.
- התראה על שינוי של 10% ומעלה, או על ירידה מתחת למחיר היעד.
  ההשוואה היא לפי המחיר הזול של המוצר בכל רשת, בין היום האחרון ליום שלפניו, ורק
  בסניפים שיש להם מחיר בשני הימים. כך לא נוצרת התראה נפרדת לכל סניף.
"""
from __future__ import annotations

import logging
import smtplib
from dataclasses import dataclass
from datetime import date
from decimal import Decimal
from email.message import EmailMessage
from typing import Optional

from .config import Config

log = logging.getLogger("ingest.tracking")


# ---------- לוגיקה טהורה ----------

def change_pct(old: Decimal, new: Decimal) -> Decimal:
    """אחוז השינוי מ-old ל-new (שלילי = ירידה)."""
    return (new - old) / old * 100


def is_significant(old: Optional[Decimal], new: Decimal, threshold_pct: float) -> bool:
    """שינוי של threshold_pct אחוזים ומעלה, לכל כיוון."""
    if old is None or old <= 0 or new == old:
        return False
    return abs(change_pct(old, new)) >= Decimal(str(threshold_pct))


def crossed_target(old: Optional[Decimal], new: Decimal, target: Optional[Decimal]) -> bool:
    """המחיר ירד אל מחיר היעד או מתחתיו, ולא היה שם כבר קודם."""
    if target is None or new > target:
        return False
    return old is None or old > target


@dataclass(frozen=True)
class Alert:
    product: str
    chain: str
    store: Optional[str]
    kind: str
    old_price: Optional[Decimal]
    new_price: Decimal
    pct: Optional[Decimal]
    target_price: Optional[Decimal]


def alert_line(alert: Alert) -> str:
    where = f"{alert.chain}" + (f" ({alert.store})" if alert.store else "")
    if alert.kind == "target":
        return (f"{alert.product}: ₪{alert.new_price:.2f} ב{where} – "
                f"מתחת למחיר היעד ₪{alert.target_price:.2f}")
    direction = "ירד" if alert.pct is not None and alert.pct < 0 else "עלה"
    return (f"{alert.product}: {direction} ב-{abs(alert.pct):.0f}% ב{where}, "
            f"מ-₪{alert.old_price:.2f} ל-₪{alert.new_price:.2f}")


def build_digest(alerts: list[Alert], day: date, sender: str, recipients: list[str],
                 app_url: str = "") -> EmailMessage:
    """מייל יומי מרוכז: ירידות מחיר ויעדים קודם, אחריהן עליות."""
    drops = [a for a in alerts if a.kind == "target" or (a.pct is not None and a.pct < 0)]
    rises = [a for a in alerts if a not in drops]
    lines: list[str] = [f"התראות מחירים ליום {day:%d.%m.%Y}", ""]
    for title, group in (("ירידות מחיר ומחירי יעד", drops), ("עליות מחיר", rises)):
        if group:
            lines += [f"{title} ({len(group)}):"] + [f"  • {alert_line(a)}" for a in group] + [""]
    if app_url:
        lines.append(f"לכל ההתראות: {app_url.rstrip('/')}/alerts")
    message = EmailMessage()
    message["Subject"] = f"פראיירמטר: {len(alerts)} התראות מחיר"
    message["From"] = sender
    message["To"] = ", ".join(recipients)
    message.set_content("\n".join(lines))
    # גרסת HTML מימין לשמאל
    html = "".join(f"<p>{line}</p>" if line else "" for line in lines)
    message.add_alternative(f'<div dir="rtl" style="font-family:sans-serif">{html}</div>',
                            subtype="html")
    return message


# ---------- מסד נתונים ----------

_WATCHED = """
    SELECT product_id FROM tracked_products
    UNION
    SELECT product_id FROM list_item_products
"""


_IN_RADIUS = """
    (NOT EXISTS (SELECT 1 FROM addresses WHERE lat IS NOT NULL)
     OR EXISTS (SELECT 1 FROM addresses a WHERE a.lat IS NOT NULL AND s.lat IS NOT NULL
                AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km))
"""


def snapshot(conn) -> int:
    """שומר ב-price_history את המחירים הנוכחיים של המוצרים במעקב וברשימות, בסניפים
    שברדיוס הכתובות השמורות. היום הוא תאריך קובץ המחירים, כך שסניף שלא עודכן לא יוצר
    נקודה חדשה."""
    return conn.execute(
        f"""INSERT INTO price_history (product_id, store_pk, day, price)
            SELECT pr.product_id, pr.store_pk, (pr.file_time AT TIME ZONE 'Asia/Jerusalem')::date,
                   pr.price
            FROM prices pr JOIN stores s ON s.id = pr.store_pk
            WHERE pr.product_id IN ({_WATCHED}) AND {_IN_RADIUS}
            ON CONFLICT (product_id, store_pk, day) DO UPDATE SET price = EXCLUDED.price
            WHERE price_history.price <> EXCLUDED.price"""
    ).rowcount


def _user_watched(user_id: int) -> str:
    """המוצרים שהמשתמש עוקב אחריהם או שנמצאים ברשימות שלו."""
    return f"""
        SELECT product_id FROM tracked_products WHERE user_id = {int(user_id)}
        UNION
        SELECT ip.product_id FROM list_item_products ip
        JOIN list_items i ON i.id = ip.item_id JOIN lists l ON l.id = i.list_id
        WHERE l.user_id = {int(user_id)}
    """


def _user_in_radius(user_id: int) -> str:
    """הסניף (s) ברדיוס של אחת מכתובות המשתמש; למשתמש בלי כתובות, כל הסניפים."""
    return f"""
        (NOT EXISTS (SELECT 1 FROM addresses WHERE user_id = {int(user_id)} AND lat IS NOT NULL)
         OR EXISTS (SELECT 1 FROM addresses a WHERE a.user_id = {int(user_id)} AND a.lat IS NOT NULL
                    AND s.lat IS NOT NULL
                    AND distance_km(a.lat, a.lng, s.lat, s.lng) <= a.radius_km))
    """


def create_alerts(conn, threshold_pct: float) -> int:
    """התראות לכל משתמש: לפי המוצרים שלו, הסניפים שברדיוס שלו והרשתות שלא הסתיר."""
    users = [row[0] for row in conn.execute("SELECT id FROM users ORDER BY id").fetchall()]
    return sum(create_user_alerts(conn, user_id, threshold_pct) for user_id in users)


def create_user_alerts(conn, user_id: int, threshold_pct: float) -> int:
    """יוצר התראות ליום האחרון שיש לו היסטוריה, מול היום הקודם של אותו מוצר באותה רשת."""
    rows = conn.execute(
        f"""WITH latest AS (      -- היום האחרון והיום שלפניו, לכל מוצר ורשת
                SELECT product_id, chain_key, max(day) AS day,
                       (array_agg(DISTINCT day ORDER BY day DESC))[2] AS prev_day
                FROM price_history h JOIN stores s ON s.id = h.store_pk
                WHERE h.product_id IN ({_user_watched(user_id)}) AND {_user_in_radius(user_id)}
                GROUP BY product_id, chain_key
            )
            SELECT l.product_id, l.chain_key,
                   (array_agg(cur.store_pk ORDER BY cur.price, cur.store_pk))[1] AS store_pk,
                   l.day,
                   -- משווים רק סניפים שיש להם מחיר בשני הימים, כדי שסניף שלא עודכן
                   -- (או שנוסף) לא ייראה כשינוי מחיר
                   min(prev.price) AS old_price,
                   COALESCE(min(cur.price) FILTER (WHERE prev.price IS NOT NULL), min(cur.price))
                       AS new_price,
                   t.target_price
            FROM latest l
            JOIN chains c ON c.key = l.chain_key AND NOT EXISTS (
                SELECT 1 FROM user_hidden_chains hc
                WHERE hc.user_id = %(user)s AND hc.chain_key = c.key)
            JOIN stores s ON s.chain_key = l.chain_key AND {_user_in_radius(user_id)}
            JOIN price_history cur ON cur.product_id = l.product_id AND cur.store_pk = s.id
                                  AND cur.day = l.day
            LEFT JOIN price_history prev ON prev.product_id = l.product_id
                                        AND prev.store_pk = s.id AND prev.day = l.prev_day
            LEFT JOIN tracked_products t ON t.product_id = l.product_id AND t.user_id = %(user)s
            GROUP BY l.product_id, l.chain_key, l.day, t.target_price""",
        {"user": user_id},
    ).fetchall()
    created = 0
    insert = """INSERT INTO alerts (user_id, product_id, chain_key, store_pk, kind, day, old_price,
                                    new_price, pct, target_price)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, product_id, chain_key, kind, day) DO NOTHING"""
    by_product: dict[int, list] = {}
    for row in rows:
        product_id, chain_key, store_pk, day, old, new, _target = row
        by_product.setdefault(product_id, []).append(row)
        if is_significant(old, new, threshold_pct):
            created += conn.execute(insert, (user_id, product_id, chain_key, store_pk, "change", day,
                                             old, new, change_pct(old, new), None)).rowcount

    # מחיר יעד: התראה אחת למוצר, לפי המחיר הזול מבין כל הרשתות
    for product_id, chain_rows in by_product.items():
        target = chain_rows[0][6]
        if target is None:
            continue
        cheapest = min(chain_rows, key=lambda r: r[5])
        _, chain_key, store_pk, day, _old, new, _ = cheapest
        previous = [r[4] for r in chain_rows if r[4] is not None]
        old = min(previous) if previous else None
        if not crossed_target(old, new, target):
            continue
        already = conn.execute(
            """SELECT 1 FROM alerts
               WHERE user_id = %s AND product_id = %s AND kind = 'target' AND day = %s""",
            (user_id, product_id, day)).fetchone()
        if already is None:
            created += conn.execute(insert, (user_id, product_id, chain_key, store_pk, "target", day,
                                             old, new, change_pct(old, new) if old else None,
                                             target)).rowcount
    return created


def update(conn, cfg: Config) -> tuple[int, int]:
    """אחרי טעינת מחירים: היסטוריה ואז התראות. מחזיר (שורות היסטוריה, התראות חדשות)."""
    saved = snapshot(conn)
    created = create_alerts(conn, cfg.alert_change_pct)
    if saved or created:
        log.info("מעקב: %d נקודות היסטוריה, %d התראות חדשות", saved, created)
    return saved, created


def send_digest(conn, cfg: Config) -> int:
    """שולח לכל משתמש מייל אחד עם ההתראות שלו שעוד לא נשלחו, לכתובת ה-Gmail שלו.
    מחזיר כמה התראות נשלחו (0 אם אין, או אם המייל לא מוגדר)."""
    if not cfg.smtp_host:
        return 0
    users = conn.execute(
        """SELECT u.id, u.email FROM users u
           WHERE position('@' in u.email) > 0
             AND EXISTS (SELECT 1 FROM alerts a WHERE a.user_id = u.id AND a.emailed_at IS NULL)
           ORDER BY u.id"""
    ).fetchall()
    sent = 0
    for user_id, email in users:
        rows = conn.execute(
            """SELECT a.id, p.name, c.name, s.name, a.kind, a.old_price, a.new_price, a.pct,
                      a.target_price
               FROM alerts a
               JOIN products p ON p.id = a.product_id
               JOIN chains c ON c.key = a.chain_key
               LEFT JOIN stores s ON s.id = a.store_pk
               WHERE a.emailed_at IS NULL AND a.user_id = %s
               ORDER BY a.kind DESC, a.pct NULLS LAST, p.name""",
            (user_id,),
        ).fetchall()
        alerts = [Alert(*row[1:]) for row in rows]
        message = build_digest(alerts, date.today(), cfg.smtp_from or cfg.smtp_user, [email],
                               cfg.app_url)
        try:
            smtp_class = smtplib.SMTP_SSL if cfg.smtp_port == 465 else smtplib.SMTP
            with smtp_class(cfg.smtp_host, cfg.smtp_port, timeout=30) as smtp:
                if cfg.smtp_port != 465 and cfg.smtp_starttls:
                    smtp.starttls()
                if cfg.smtp_user:
                    smtp.login(cfg.smtp_user, cfg.smtp_password)
                smtp.send_message(message)
        except (OSError, smtplib.SMTPException) as error:  # משתמש אחד שנכשל לא עוצר את השאר
            log.warning("המייל היומי ל-%s נכשל: %s", email, error)
            continue
        conn.execute("UPDATE alerts SET emailed_at = now() WHERE id = ANY(%s)",
                     ([r[0] for r in rows],))
        sent += len(rows)
    if sent:
        log.info("נשלחו %d התראות במייל היומי ל-%d משתמשים", sent, len(users))
    return sent
