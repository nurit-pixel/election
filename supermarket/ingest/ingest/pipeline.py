"""הורדה -> פענוח (il_supermarket_parsers) -> טעינה ל-PostgreSQL, לרשת אחת בכל פעם.

ההורדה נעשית עם il-supermarket-scraper, או עם המוריד שלנו ל-Cerberus (ראו chains.py).
כשל ברשת אחת נרשם ב-ingest_runs ואינו עוצר את שאר הרשתות.
"""
from __future__ import annotations

import asyncio
import logging
import os
import traceback
from datetime import datetime, timedelta
from typing import Optional

from il_supermarket_parsers import ParserFactory
from il_supermarket_parsers.utils.data_loaders.data_loader import DataLoader
from il_supermarket_scarper import ScraperFactory
from il_supermarket_scarper.utils import DiskFileOutput, DumpFolderNames, FileTypesFilters

from . import db, filenames, normalize
from .cerberus import CerberusClient
from .chains import Chain
from .config import Config

log = logging.getLogger("ingest")
# הספריות כותבות לוג DEBUG מפורט מאוד; מספיקות לנו שגיאות חמורות
for _name in ("Logger", "mylogger"):
    logging.getLogger(_name).setLevel(logging.CRITICAL)

STORE = FileTypesFilters.STORE_FILE.name
PRICE_FULL = FileTypesFilters.PRICE_FULL_FILE.name
PROMO_FULL = FileTypesFilters.PROMO_FULL_FILE.name
FILE_TYPE = {"stores": STORE, "prices": PRICE_FULL, "promos": PROMO_FULL}
SEARCH = {STORE: "Stores", PRICE_FULL: "PriceFull", PROMO_FULL: "PromoFull"}
CHAIN_TIMEOUT_SECONDS = 45 * 60


def chain_dump_dir(cfg: Config, chain: Chain) -> str:
    # ה-parser מצפה לתיקייה בשם הרשת כפי שהיא מוגדרת בספרייה
    return os.path.join(cfg.dumps_dir, DumpFolderNames[chain.key].value)


def _reset_library_memory(cfg: Config, chain: Chain) -> None:
    """ה-scraper של הספרייה זוכר אילו קבצים הוריד ומדלג עליהם. מקור האמת שלנו הוא
    הטבלה ingest_files, ולכן מוחקים את הזיכרון שלו לפני כל ריצה."""
    path = os.path.join(cfg.dumps_dir, "status", f"{DumpFolderNames[chain.key].value.lower()}.json")
    if os.path.exists(path):
        os.remove(path)


# ---------- הורדה ----------

async def _download_library(cfg: Config, chain: Chain, file_type: str,
                            store_ids: Optional[list[str]]) -> list[str]:
    _reset_library_memory(cfg, chain)
    scraper = ScraperFactory.get(chain.key)(
        file_output=DiskFileOutput(storage_path=chain_dump_dir(cfg, chain))
    )
    errors: list[str] = []
    found = 0

    async def run(**kwargs) -> None:
        nonlocal found
        async for result in scraper.scrape(files_types=[file_type], **kwargs):
            found += 1
            if not result.extract_succefully:
                errors.append(f"{result.file_name}: {result.error}")
        await asyncio.sleep(cfg.request_delay)

    if file_type == STORE:
        await run(limit=1)
    elif store_ids is None:
        await run()
    else:
        for store_id in store_ids:
            await run(store_id=int(store_id))
    if found == 0 and not errors:
        # הספרייה בולעת שגיאות רשת ומחזירה "אין קבצים"
        errors.append("לא התקבלו קבצים מהאתר (ייתכן שהאתר חסום או לא זמין)")
    return errors


def _download_cerberus(cfg: Config, chain: Chain, file_type: str,
                       store_ids: Optional[list[str]], already_loaded: set[str]) -> list[str]:
    client = CerberusClient(chain.username, chain.password, chain.path, cfg.request_delay)
    client.login()
    names = client.list_files(SEARCH[file_type])
    wanted = filenames.latest_per_store(
        names, file_type, set(store_ids) if store_ids is not None else None
    )
    oldest = datetime.now() - timedelta(days=cfg.max_file_age_days)
    errors: list[str] = []
    for f in wanted:
        if db.stem(f.name) in already_loaded or f.time < oldest:
            continue
        try:
            client.download(f.name, chain_dump_dir(cfg, chain))
        except Exception as exc:  # pylint: disable=broad-exception-caught
            errors.append(f"{f.name}: {exc}")
    if not any(filenames.parse(n) and filenames.parse(n).file_type == file_type for n in names):
        errors.append("לא נמצאו קבצים מהסוג הזה באתר")
    return errors


async def download(cfg: Config, chain: Chain, file_type: str, store_ids: Optional[list[str]],
                   already_loaded: set[str]) -> list[str]:
    """מוריד לתיקיית ה-dumps. מחזיר רשימת שגיאות (ריקה אם הכול הצליח)."""
    if chain.source == "cerberus":
        return await asyncio.to_thread(
            _download_cerberus, cfg, chain, file_type, store_ids, already_loaded
        )
    return await _download_library(cfg, chain, file_type, store_ids)


# ---------- טעינה ----------

async def load_dumps(cfg: Config, chain: Chain, conn, already_loaded: set[str],
                     force: bool = False) -> tuple[int, int, int, list[str]]:
    """טוען למסד את כל הקבצים שממתינים בתיקיית ההורדות. קובץ שנטען נמחק מהדיסק;
    קובץ שנכשל נשאר לניסיון הבא ואינו עוצר את שאר הקבצים."""
    converter = ParserFactory[chain.key].value()
    loaded = failed = total_rows = 0
    errors: list[str] = []
    if not os.path.isdir(chain_dump_dir(cfg, chain)):
        return 0, 0, 0, errors
    oldest = datetime.now() - timedelta(days=cfg.max_file_age_days)

    async for dump in DataLoader(cfg.dumps_dir).load(
        enabled_scraper=[chain.key], files_types=[STORE, PRICE_FULL, PROMO_FULL]
    ):
        path = dump.get_full_path
        try:
            if not force and db.stem(dump.file_name) in already_loaded:
                os.remove(path)
                continue
            if dump.extracted_date < oldest:
                # חלק מהאתרים מחזירים גם קבצים של ימים קודמים; קובץ ישן לא נטען
                os.remove(path)
                continue
            raw = [row async for row in converter.read(dump)]
            file_chain_id = normalize.chain_id(dump.extracted_chain_id) or ""
            if dump.detected_filetype.name == STORE:
                rows = [r for r in map(normalize.store_row, raw) if r]
                count = db.load_stores(conn, chain, dump.file_name, dump.extracted_date,
                                       file_chain_id, rows)
            else:
                # מספר הסניף ומזהה הרשת נלקחים מתוך ה-XML; שם הקובץ הוא רק גיבוי
                first = raw[0] if raw else {}
                store_id = normalize.store_number(first.get("storeid")) \
                    or normalize.store_number(dump.extracted_store_number)
                if store_id is None:
                    raise ValueError("לא נמצא StoreId בקובץ")
                xml_chain_id = normalize.chain_id(first.get("chainid")) or file_chain_id
                if dump.detected_filetype.name == PROMO_FULL:
                    rows = [r for r in map(normalize.promo_row, raw) if r]
                    count = db.load_promo_full(conn, chain, xml_chain_id, store_id,
                                               dump.file_name, dump.extracted_date, rows)
                else:
                    rows = [r for r in (normalize.price_row(x, chain.key) for x in raw) if r]
                    count = db.load_price_full(conn, chain, xml_chain_id, store_id,
                                               dump.file_name, dump.extracted_date, rows)
            log.info("%s: נטען %s (%d שורות)", chain.name, dump.file_name, count)
            loaded += 1
            total_rows += count
            os.remove(path)
        except db.EmptyFile:
            log.info("%s: %s ריק, מדלג", chain.name, dump.file_name)
            os.remove(path)
        except Exception as exc:  # pylint: disable=broad-exception-caught
            failed += 1
            errors.append(f"{dump.file_name}: {exc}")
            log.error("כשל בטעינת %s\n%s", dump.file_name, traceback.format_exc())
    return loaded, failed, total_rows, errors


# ---------- ריצה לרשת ----------

def run_chain(cfg: Config, conn, chain: Chain, kind: str,
              store_ids: Optional[list[str]] = None, force: bool = False) -> str:
    """kind: "stores" (רשימת סניפים), "prices" (PriceFull) או "promos" (PromoFull).
    store_ids=None -> כל הסניפים. נרשם ב-ingest_runs. מחזיר את הסטטוס: ok / partial / failed."""
    file_type = FILE_TYPE[kind]
    run_id = db.start_run(conn, chain, kind)
    loaded = failed = rows = 0
    errors: list[str] = []

    async def work():
        nonlocal loaded, failed, rows
        already = set() if force else db.loaded_file_names(conn, chain)
        errors.extend(await download(cfg, chain, file_type, store_ids, already))
        loaded, failed, rows, load_errors = await load_dumps(cfg, chain, conn, already, force)
        errors.extend(load_errors)

    try:
        asyncio.run(asyncio.wait_for(work(), CHAIN_TIMEOUT_SECONDS))
        if errors:
            status = "partial" if loaded else "failed"
        else:
            status = "ok"       # כולל המקרה שאין קבצים חדשים לטעון
    except Exception as exc:  # pylint: disable=broad-exception-caught
        status = "failed"
        errors.append(f"{type(exc).__name__}: {exc}")
        log.error("%s: הריצה נכשלה\n%s", chain.name, traceback.format_exc())
    db.finish_run(conn, run_id, status, loaded, failed, rows, "\n".join(errors)[:4000] or None)
    log.info("%s (%s): %s – %d קבצים נטענו, %d נכשלו, %d שורות%s", chain.name, kind, status,
             loaded, failed, rows, f" | {errors[0][:200]}" if errors else "")
    return status


def refresh_stores(cfg: Config, conn, chains: list[Chain], force: bool = False) -> dict[str, str]:
    return {c.key: run_chain(cfg, conn, c, "stores", force=force) for c in chains}


def refresh_prices(cfg: Config, conn, chains: list[Chain], address_id: Optional[int] = None,
                   all_stores: bool = False, force: bool = False) -> dict[str, str]:
    """מחירים ומבצעים לסניפים ברדיוס הכתובות השמורות (או לכל הסניפים).
    רשת בלי סניפים ברדיוס מדולגת. המבצעים נטענים אחרי המחירים, כי הם מפנים למוצרים."""
    statuses: dict[str, str] = {}
    for chain in chains:
        store_ids = None if all_stores else db.store_ids_in_radius(conn, chain, address_id)
        if store_ids is not None and not store_ids:
            continue
        statuses[chain.key] = run_chain(cfg, conn, chain, "prices", store_ids, force)
        if statuses[chain.key] != "failed":
            run_chain(cfg, conn, chain, "promos", store_ids, force)
    return statuses
