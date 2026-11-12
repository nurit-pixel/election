"""המרת שורות גולמיות מה-parser (מילון עם מפתחות lowercase) לערכים נקיים למסד.

פונקציות טהורות, בלי רשת ובלי מסד, כדי שיהיה קל לבדוק אותן.
"""
from __future__ import annotations

import csv
import os
import re
from datetime import datetime
from decimal import Decimal, InvalidOperation
from typing import Optional


def _load_cities() -> dict[str, str]:
    path = os.path.join(os.path.dirname(__file__), "data", "cities.csv")
    with open(path, encoding="utf-8", newline="") as f:
        return {row["code"]: row["name"] for row in csv.DictReader(f)}


_CITIES = _load_cities()   # סמל יישוב של הלמ"ס -> שם יישוב
CITY_NAMES = frozenset(_CITIES.values())


def city_name(value) -> Optional[str]:
    """חלק מהרשתות (למשל שופרסל) מפרסמות את העיר כסמל יישוב של הלמ"ס ולא כשם."""
    text = clean(value)
    if text is None or text in ("0", "-"):
        return None
    if text.isdigit():
        return _CITIES.get(text.lstrip("0"))
    return text


def clean(value) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in ("nan", "none", "no_body", "לא ידוע"):
        return None
    return text


def store_number(value) -> Optional[str]:
    """'001' -> '1'. מספר הסניף מופיע עם ובלי אפסים מובילים בקבצים שונים."""
    text = clean(value)
    if text is None:
        return None
    return text.lstrip("0") or "0"


def chain_id(value) -> Optional[str]:
    text = clean(value)
    return re.sub(r"\D", "", text) or None if text else None


def decimal(value) -> Optional[Decimal]:
    text = clean(value)
    if text is None:
        return None
    try:
        return Decimal(text.replace(",", ""))
    except InvalidOperation:
        return None


def flag(value) -> bool:
    return clean(value) in ("1", "true", "True")


def timestamp(value) -> Optional[datetime]:
    """זמן מקומי (שעון ישראל) בלי אזור זמן; המסד מפרש לפי ה-TimeZone של החיבור."""
    text = clean(value)
    if text is None:
        return None
    text = text.replace("T", " ").replace("/", "-").split(".")[0]
    for fmt in ("%Y-%m-%d %H:%M:%S", "%Y-%m-%d %H:%M", "%Y-%m-%d"):
        try:
            return datetime.strptime(text, fmt)
        except ValueError:
            continue
    return None


def price_row(row: dict, chain_key: str) -> Optional[dict]:
    """שורת Item מקובץ Price/PriceFull. מחזיר None לשורה שאי אפשר לטעון."""
    barcode = clean(row.get("itemcode"))
    price = decimal(row.get("itemprice"))
    if barcode is None or price is None or price <= 0:
        return None
    barcode = barcode.lstrip("0") or barcode
    # ItemType=0 הוא קוד פנימי של הרשת ולא ברקוד, ולכן אינו בר-השוואה בין רשתות
    is_internal = clean(row.get("itemtype")) == "0"
    name = clean(row.get("itemname")) or clean(row.get("itemnm")) \
        or clean(row.get("manufactureitemdescription")) or barcode
    return {
        "barcode": barcode,
        "internal_chain": chain_key if is_internal else "",
        "name": name,
        "manufacturer": clean(row.get("manufacturename")) or clean(row.get("manufacturername")),
        "unit_qty": clean(row.get("unitqty")),
        "quantity": decimal(row.get("quantity")),
        "unit_of_measure": clean(row.get("unitofmeasure")),
        "is_weighted": flag(row.get("bisweighted")),
        "price": price,
        "unit_price": decimal(row.get("unitofmeasureprice")),
        "allow_discount": flag(row.get("allowdiscount")),
        "price_update_time": timestamp(row.get("priceupdatetime") or row.get("priceupdatedate")),
    }


def store_row(row: dict) -> Optional[dict]:
    """שורת Store מקובץ Stores."""
    number = store_number(row.get("storeid"))
    if number is None:
        return None
    address = clean(row.get("address"))
    if address is not None and address in ("0", "-", "."):
        address = None
    return {
        "chain_id": chain_id(row.get("chainid")),
        "store_id": number,
        "sub_chain_id": clean(row.get("subchainid")),
        "sub_chain_name": clean(row.get("subchainname")),
        "name": clean(row.get("storename")),
        "address": address,
        "city": city_name(row.get("city")),
        "zip_code": clean(row.get("zipcode")),
        "store_type": clean(row.get("storetype")),
    }


# ---------- מבצעים ----------

_NO_VALUE = ("NO_BODY", "", None)
_CLUB = re.compile(r"(\d+)\s*[-=]\s*([^|&()]+)")
_ONE_PLUS_ONE = re.compile(r"(?<![\d.])1\s*\+\s*1(?![\d.])")
_SECOND_AT = re.compile(r"השני(?:ה|יה)?\s*ב[-־ ]?\s*(\d{1,3})\s*%")


def _as_list(value) -> list:
    if value in _NO_VALUE:
        return []
    return value if isinstance(value, list) else [value]


def clubs(value) -> list[tuple[int, str]]:
    """ClubId מגיע כמספר ("0"), כמספר ושם ("1 - מועדון לקוחות") או כביטוי
    ("(1=מועדון א|1=מועדון ב)"). מחזיר את המועדונים שאינם 0; רשימה ריקה = כלל הלקוחות."""
    text = clean(value)
    if text is None:
        return []
    found: dict[int, str] = {}
    for code, name in _CLUB.findall(text):
        found.setdefault(int(code), " ".join(name.split()))
    if not found and text.strip().isdigit():
        found[int(text)] = f"מועדון {int(text)}"
    return [(code, name) for code, name in sorted(found.items()) if code != 0]


def nth_item_discount(description: Optional[str]) -> Optional[tuple[int, Decimal]]:
    """"הנחה על הפריט ה-N" אינה מקודדת בשדות הקובץ אלא רק בתיאור. מזהים שני ניסוחים
    חד-משמעיים: "1+1" (השני חינם) ו"השני ב-50%"."""
    text = description or ""
    if _ONE_PLUS_ONE.search(text):
        return 2, Decimal(100)
    match = _SECOND_AT.search(text)
    if match and 0 < int(match.group(1)) <= 100:
        return 2, Decimal(match.group(1))
    return None


def _promo_item(item: dict) -> Optional[dict]:
    barcode = clean(item.get("itemcode"))
    if barcode is None or barcode == "NO_BODY":
        return None
    value = lambda key: None if item.get(key) in _NO_VALUE else item.get(key)
    return {
        "barcode": barcode.lstrip("0") or barcode,
        "is_internal": clean(value("itemtype")) == "0",
        "reward_type": clean(value("rewardtype")),
        "min_qty": decimal(value("minqty")),
        "max_qty": decimal(value("maxqty")),
        "discounted_price": decimal(value("discountedprice")),
        "discount_rate": decimal(value("discountrate")),
    }


def promo_row(row: dict) -> Optional[dict]:
    """שורת Promotion מקובץ PromoFull, במבנה החדש (Groups/Group/PromotionItems) או הישן
    (PromotionItems/Item עם שדות ההטבה ברמת המבצע). מחזיר None למבצע שלא נטען (קופון)."""
    promotion_id = clean(row.get("promotionid"))
    if promotion_id is None:
        return None
    if clean(row.get("additionaliscoupon")) == "1":
        return None      # דורש קופון אישי; לא רלוונטי להשוואת סל
    description = clean(row.get("promotiondescription"))
    restricted = False
    min_purchase = None
    items: list[dict] = []

    if "groups" in row:
        groups = _as_list((row.get("groups") or {}).get("group") if isinstance(row.get("groups"), dict) else None)
        # מבצע עם כמה קבוצות ("קנה מקבוצה א' וקבל מקבוצה ב'") אינו ניתן לחישוב לפריט בודד
        restricted = len(groups) != 1
        for group in groups:
            if not isinstance(group, dict):
                continue
            amount = decimal(None if group.get("minpurchaseamount") in _NO_VALUE else group.get("minpurchaseamount"))
            if amount and amount > 0:
                min_purchase = max(min_purchase or amount, amount)
            holder = group.get("promotionitems")
            for item in _as_list(holder.get("promotionitem") if isinstance(holder, dict) else None):
                parsed = _promo_item(item) if isinstance(item, dict) else None
                if parsed:
                    items.append(parsed)
    else:
        holder = row.get("promotionitems")
        amount = decimal(row.get("minpurchaseamnt"))
        if amount and amount > 0:
            min_purchase = amount
        for item in _as_list(holder.get("item") if isinstance(holder, dict) else None):
            if not isinstance(item, dict):
                continue
            merged = {**{k: row.get(k) for k in ("rewardtype", "minqty", "maxqty", "discountedprice", "discountrate")}, **item}
            parsed = _promo_item(merged)
            if parsed:
                items.append(parsed)
    if not items:
        return None

    club_value = row.get("clubid")
    if club_value is None and isinstance(row.get("clubs"), dict):
        club_value = " | ".join(str(c) for c in _as_list(row["clubs"].get("clubid")))
    club_list = clubs(club_value)

    # מבצע שמוגבל לימים או לשעות מסוימים לא מחושב (לא ידוע מתי קונים)
    if clean(row.get("promotiondays")):
        restricted = True
    start_hour, end_hour = clean(row.get("promotionstarthour")), clean(row.get("promotionendhour"))
    if start_hour and end_hour and not (start_hour.startswith("00:00") and end_hour.startswith("23:5")) \
            and start_hour[:5] != end_hour[:5]:
        restricted = True

    nth = nth_item_discount(description)
    return {
        "promotion_id": promotion_id,
        "description": description,
        "start_at": timestamp(row.get("promotionstartdatetime") or row.get("promotionstartdate")),
        "end_at": timestamp(row.get("promotionenddatetime") or row.get("promotionenddate")),
        "clubs": club_list,
        "club_text": ", ".join(name for _, name in club_list) or None,
        "min_purchase": min_purchase,
        "restricted": restricted,
        "nth_n": nth[0] if nth else None,
        "nth_rate": nth[1] if nth else None,
        "items": items,
    }
