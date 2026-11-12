"""פענוח שמות קבצי שקיפות המחירים: <Prefix><ChainId>-<StoreId>-<yyyyMMddHHmm>.
בפועל יש וריאציות (תת-רשת לפני הסניף, תאריך ושעה מופרדים במקף, סיומות שונות)."""
from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import datetime
from typing import Optional

_NAME = re.compile(
    r"^(PriceFull|PromoFull|StoresFull|Price|Promo|Stores)(\d+)-(.+?)(?:\.(?:xml|gz|zip))*$",
    re.IGNORECASE,
)
_TYPES = {
    "pricefull": "PRICE_FULL_FILE", "price": "PRICE_FILE",
    "promofull": "PROMO_FULL_FILE", "promo": "PROMO_FILE",
    "storesfull": "STORE_FILE", "stores": "STORE_FILE",
}


@dataclass(frozen=True)
class FileName:
    name: str
    file_type: str
    chain_id: str
    store_id: Optional[str]   # בלי אפסים מובילים
    time: Optional[datetime]  # שעון ישראל, בלי אזור זמן


def _time(date: str, clock: str = "") -> Optional[datetime]:
    clock = (clock + "000000")[:6] if len(clock) >= 4 else "000000"
    try:
        return datetime.strptime(date + clock, "%Y%m%d%H%M%S")
    except ValueError:
        return None


def parse(name: str) -> Optional[FileName]:
    match = _NAME.match(name.rsplit("/", 1)[-1])
    if not match:
        return None
    prefix, chain_id, rest = match.groups()
    parts = rest.split("-")
    time = None
    if re.fullmatch(r"20\d{10,12}", parts[-1]):                 # yyyyMMddHHmm[ss]
        time = _time(parts[-1][:8], parts[-1][8:])
        parts = parts[:-1]
    elif len(parts) >= 2 and re.fullmatch(r"20\d{6}", parts[-2]):  # yyyyMMdd-HHmm[ss]
        time = _time(parts[-2], parts[-1] if parts[-1].isdigit() else "")
        parts = parts[:-2]
    elif re.fullmatch(r"20\d{6}", parts[-1]):                   # yyyyMMdd
        time = _time(parts[-1])
        parts = parts[:-1]
    store = parts[-1] if parts and parts[-1].isdigit() else None
    return FileName(
        name=name,
        file_type=_TYPES[prefix.lower()],
        chain_id=chain_id,
        store_id=(store.lstrip("0") or "0") if store is not None else None,
        time=time,
    )


def latest_per_store(names: list[str], file_type: str,
                     store_ids: Optional[set[str]] = None) -> list[FileName]:
    """הקובץ העדכני ביותר מכל סוג לכל (רשת, סניף). store_ids=None -> כל הסניפים."""
    best: dict[tuple, FileName] = {}
    for name in names:
        f = parse(name)
        if f is None or f.file_type != file_type or f.time is None:
            continue
        if file_type != "STORE_FILE" and store_ids is not None and f.store_id not in store_ids:
            continue
        key = (f.chain_id, None if file_type == "STORE_FILE" else f.store_id)
        if key not in best or f.time > best[key].time:
            best[key] = f
    return sorted(best.values(), key=lambda f: f.name)
