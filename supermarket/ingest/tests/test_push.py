from ingest.push import build_payload
from ingest.tracking import Alert


def _alert(product, kind="change", old=10.0, new=8.0, pct=-20.0, target=None):
    return Alert(product, "שופרסל", "דיזנגוף", kind, old, new, pct, target)


def test_single_alert_title_and_link():
    payload = build_payload([_alert("במבה")], "https://example.org/")
    assert payload["title"] == "התראת מחיר"
    assert "במבה" in payload["body"]
    assert payload["url"] == "https://example.org/alerts"


def test_many_alerts_are_summarised():
    payload = build_payload([_alert(f"מוצר {i}") for i in range(5)])
    assert payload["title"] == "5 התראות מחיר חדשות"
    assert payload["body"].count("\n") == 3
    assert payload["body"].endswith("ועוד 2")
    assert payload["url"] == "/alerts"
