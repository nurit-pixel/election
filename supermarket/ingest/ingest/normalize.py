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
    text = text.replace("T", " ").replace("/", "-")
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
