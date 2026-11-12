"""Geocoding של כתובות סניפים וכתובות שמורות, עם cache במסד:
כל שאילתה נשלחת לשירות פעם אחת, וכל סניף מנוסה פעם אחת (עד שהכתובת שלו משתנה)."""
from __future__ import annotations

import logging
import re
import time
from typing import Optional

import requests

from .config import Config

log = logging.getLogger("ingest.geocode")

# גבולות גסים של ישראל, לסינון תוצאות שגויות
_LAT = (29.3, 33.5)
_LNG = (34.1, 36.0)
_last_request = 0.0


def _tidy(text: Optional[str]) -> str:
    return re.sub(r"\s+", " ", (text or "").replace('"', "").replace("'", "")).strip(" ,-")


def simplify_address(address: str) -> str:
    """מנקה קיצורים ותוספות שמפריעים ל-geocoding: רח', שד', "פינת ...", סוגריים."""
    text = re.sub(r"\(.*?\)", " ", address)
    text = re.sub(r"(^|\s)(רחוב|רח)[.' ]\s*", r"\1", text)
    text = re.sub(r"(^|\s)שד[.']\s*", r"\1שדרות ", text)
    text = re.split(r"\s(פינת|פ\.|פי')\s?", text)[0]
    text = re.sub(r"(\d),", r"\1 ", text.replace(",", " , "))
    return _tidy(re.sub(r"\s*,\s*", " ", text))


def street_only(address: str) -> str:
    """שם הרחוב בלי מספר הבית, לניסיון נוסף כשהמספר לא מוכר לשירות."""
    return _tidy(re.sub(r"\d+\S*", " ", simplify_address(address)))


def infer_city(name: Optional[str]) -> Optional[str]:
    """רשתות שלא מפרסמות עיר נותנות בדרך כלל את שם היישוב בשם הסניף.
    מחפשים שם יישוב רשמי כמילה שלמה; אם יש כמה – הארוך ביותר.
    בכתובת לא מחפשים: יש יישובים ששמם מילה נפוצה בכתובות (למשל המושב "רחוב")."""
    from .normalize import CITY_NAMES

    words = f" {re.sub(r'[,.()/-]', ' ', _tidy(name))} "
    found = [c for c in CITY_NAMES if len(c) >= 3 and f" {c} " in words]
    return max(found, key=len) if found else None


def store_queries(address: Optional[str], city: Optional[str],
                  name: Optional[str] = None) -> list[tuple[str, str]]:
    """שאילתות לפי סדר עדיפות: (שאילתה, רמת דיוק address / street / city).
    בלי עיר לא שולחים כתובת לבדה: אותו רחוב קיים בערים רבות."""
    address, city = _tidy(address), _tidy(city) or infer_city(name)
    if not city:
        return []
    queries: list[tuple[str, str]] = []
    if address and address != city:
        simple = simplify_address(address)
        for street in dict.fromkeys((address, simple)):
            if street:
                queries.append((street if city in street else f"{street}, {city}", "address"))
        street = street_only(address)
        if street and street != simple and street != city:
            queries.append((f"{street}, {city}", "street"))
    queries.append((city, "city"))
    return queries


def _fetch(cfg: Config, query: str) -> Optional[tuple[float, float, str]]:
    global _last_request  # pylint: disable=global-statement
    wait = cfg.geocoder_delay - (time.monotonic() - _last_request)
    if wait > 0:
        time.sleep(wait)
    try:
        response = requests.get(
            cfg.geocoder_url,
            params={"q": query, "format": "jsonv2", "limit": 1, "countrycodes": "il",
                    "accept-language": "he"},
            headers={"User-Agent": cfg.geocoder_user_agent},
            timeout=30,
        )
    finally:
        _last_request = time.monotonic()
    response.raise_for_status()
    results = response.json()
    if not results:
        return None
    lat, lng = float(results[0]["lat"]), float(results[0]["lon"])
    if not (_LAT[0] <= lat <= _LAT[1] and _LNG[0] <= lng <= _LNG[1]):
        return None
    return lat, lng, results[0].get("display_name", "")


def lookup(cfg: Config, conn, query: str) -> Optional[tuple[float, float]]:
    """מחזיר (lat, lng) או None. תוצאה (גם "לא נמצא") נשמרת ב-cache."""
    row = conn.execute("SELECT lat, lng FROM geocode_cache WHERE query = %s", (query,)).fetchone()
    if row is not None:
        return (row[0], row[1]) if row[0] is not None else None
    found = _fetch(cfg, query)     # שגיאת רשת נזרקת ולא נשמרת ב-cache
    conn.execute(
        """INSERT INTO geocode_cache (query, lat, lng, display_name, provider)
           VALUES (%s, %s, %s, %s, %s) ON CONFLICT (query) DO NOTHING""",
        (query, found[0] if found else None, found[1] if found else None,
         found[2] if found else None, cfg.geocoder_url),
    )
    return (found[0], found[1]) if found else None


def geocode_stores(cfg: Config, conn, limit: Optional[int] = None) -> int:
    """Geocoding לסניפים שעוד לא נוסו. מחזיר כמה סניפים טופלו."""
    rows = conn.execute(
        """SELECT id, address, city, name FROM stores WHERE geocoded_at IS NULL
           ORDER BY id LIMIT %s""",
        (limit,),
    ).fetchall()
    for store_pk, address, city, name in rows:
        lat = lng = None
        precision = "none"
        for query, level in store_queries(address, city, name):
            found = lookup(cfg, conn, query)
            if found:
                lat, lng = found
                precision = level
                break
        conn.execute(
            """UPDATE stores SET lat = %s, lng = %s, geocode_precision = %s, geocoded_at = now()
               WHERE id = %s""",
            (lat, lng, precision, store_pk),
        )
    return len(rows)


def geocode_addresses(cfg: Config, conn) -> list[int]:
    """Geocoding לכתובות שמורות שממתינות. מחזיר את מזהי הכתובות שנמצאו."""
    found_ids = []
    for address_id, address in conn.execute(
        "SELECT id, address FROM addresses WHERE geocoded_at IS NULL ORDER BY id"
    ).fetchall():
        found = lookup(cfg, conn, _tidy(address))
        conn.execute(
            """UPDATE addresses SET lat = %s, lng = %s, geocoded_at = now(), geocode_error = %s
               WHERE id = %s""",
            (found[0] if found else None, found[1] if found else None,
             None if found else "הכתובת לא נמצאה", address_id),
        )
        if found:
            found_ids.append(address_id)
    return found_ids
