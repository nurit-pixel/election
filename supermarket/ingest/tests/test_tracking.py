from datetime import date
from decimal import Decimal as D

from ingest import tracking
from ingest.tracking import Alert


def test_change_of_ten_percent_or_more_is_significant():
    assert tracking.is_significant(D("10.00"), D("9.00"), 10) is True      # בדיוק 10% ירידה
    assert tracking.is_significant(D("10.00"), D("11.00"), 10) is True     # בדיוק 10% עלייה
    assert tracking.is_significant(D("10.00"), D("9.10"), 10) is False     # 9%
    assert tracking.is_significant(D("10.00"), D("10.90"), 10) is False
    assert tracking.is_significant(D("5.90"), D("4.90"), 10) is True       # 17%


def test_no_alert_without_previous_price_or_without_change():
    assert tracking.is_significant(None, D("9.00"), 10) is False
    assert tracking.is_significant(D("9.00"), D("9.00"), 10) is False
    assert tracking.is_significant(D("0"), D("9.00"), 10) is False


def test_change_pct_sign():
    assert tracking.change_pct(D("10"), D("8")) == D("-20")
    assert tracking.change_pct(D("10"), D("12")) == D("20")


def test_target_price_crossing():
    assert tracking.crossed_target(D("12.90"), D("9.90"), D("10")) is True
    assert tracking.crossed_target(D("12.90"), D("10.00"), D("10")) is True   # בדיוק ביעד
    assert tracking.crossed_target(D("12.90"), D("10.90"), D("10")) is False  # עדיין מעל
    assert tracking.crossed_target(D("9.50"), D("9.00"), D("10")) is False    # כבר היה מתחת
    assert tracking.crossed_target(None, D("9.00"), D("10")) is True          # מדידה ראשונה
    assert tracking.crossed_target(D("12.90"), D("9.90"), None) is False      # אין יעד


def test_digest_email():
    alerts = [
        Alert("במבה 200 גרם", "רמי לוי", "בן יהודה", "change", D("5.90"), D("4.90"), D("-16.95"), None),
        Alert("קוטג' 5%", "שופרסל", None, "change", D("6.40"), D("7.40"), D("15.63"), None),
        Alert("שמן זית", "יוחננוף", "מפוח", "target", D("49.90"), D("29.90"), D("-40.08"), D("30")),
    ]
    message = tracking.build_digest(alerts, date(2026, 11, 13), "from@example.org",
                                    ["a@example.org", "b@example.org"], "https://sal.example.org/")
    assert message["Subject"] == "פראיירמטר: 3 התראות מחיר"
    assert message["To"] == "a@example.org, b@example.org"
    body = message.get_body(("plain",)).get_content()
    assert "13.11.2026" in body
    assert "במבה 200 גרם: ירד ב-17% ברמי לוי (בן יהודה), מ-₪5.90 ל-₪4.90" in body
    assert "קוטג' 5%: עלה ב-16% בשופרסל, מ-₪6.40 ל-₪7.40" in body
    assert "שמן זית: ₪29.90 ביוחננוף (מפוח) – מתחת למחיר היעד ₪30.00" in body
    assert body.index("ירידות מחיר") < body.index("עליות מחיר")
    assert "https://sal.example.org/alerts" in body
    assert 'dir="rtl"' in message.get_body(("html",)).get_content()
