"""הורדה (il-supermarket-scraper) -> פענוח (il_supermarket_parsers) -> טעינה ל-PostgreSQL."""
from __future__ import annotations

import asyncio
import logging
import os
import traceback

from il_supermarket_parsers import ParserFactory
from il_supermarket_parsers.utils.data_loaders.data_loader import DataLoader
from il_supermarket_scarper import ScraperFactory
from il_supermarket_scarper.utils import DiskFileOutput, DumpFolderNames, FileTypesFilters

from . import db, normalize
from .chains import Chain
from .config import Config

log = logging.getLogger("ingest")
# הספריות כותבות לוג DEBUG מפורט מאוד; מספיקות לנו שגיאות
for _name in ("Logger", "mylogger"):
    logging.getLogger(_name).setLevel(logging.ERROR)

STORE = FileTypesFilters.STORE_FILE
PRICE_FULL = FileTypesFilters.PRICE_FULL_FILE


def chain_dump_dir(cfg: Config, chain: Chain) -> str:
    # ה-parser מצפה לתיקייה בשם הרשת כפי שהיא מוגדרת בספרייה
    return os.path.join(cfg.dumps_dir, DumpFolderNames[chain.key].value)


def reset_download_memory(cfg: Config, chain: Chain) -> None:
    """ה-scraper זוכר אילו קבצים כבר הוריד ומדלג עליהם. מוחקים את הזיכרון הזה כדי
    שיוריד שוב את הקבצים העדכניים (למשל אחרי שהמסד אופס)."""
    path = os.path.join(cfg.dumps_dir, "status", f"{DumpFolderNames[chain.key].value.lower()}.json")
    if os.path.exists(path):
        os.remove(path)
        log.info("%s: זיכרון ההורדות אופס", chain.name)


async def download(cfg: Config, chain: Chain, store_ids: list[int] | None) -> list[str]:
    """מוריד קובץ סניפים וקבצי PriceFull. store_ids=None -> כל הסניפים.
    מחזיר רשימת שגיאות (ריקה אם הכול הצליח)."""
    errors: list[str] = []
    scraper = ScraperFactory.get(chain.key)(
        file_output=DiskFileOutput(storage_path=chain_dump_dir(cfg, chain))
    )

    async def run(label: str, **kwargs) -> None:
        found = 0
        async for result in scraper.scrape(**kwargs):
            found += 1
            if not result.extract_succefully:
                errors.append(f"{label}: {result.file_name}: {result.error}")
        log.info("%s: %s – %d קבצים", chain.name, label, found)
        await asyncio.sleep(cfg.request_delay)

    await run("סניפים", files_types=[STORE.name])
    if store_ids is None:
        await run("מחירים, כל הסניפים", files_types=[PRICE_FULL.name])
    else:
        for store_id in store_ids:
            await run(f"מחירים, סניף {store_id}", files_types=[PRICE_FULL.name], store_id=store_id)
    return errors


async def load_dumps(cfg: Config, chain: Chain, conn, force: bool = False) -> tuple[int, int, int, list[str]]:
    """טוען למסד את כל הקבצים שממתינים בתיקיית ההורדות. קובץ שנטען נמחק מהדיסק;
    קובץ שנכשל נשאר לניסיון הבא ואינו עוצר את שאר הקבצים."""
    converter = ParserFactory[chain.key].value()
    loaded = failed = total_rows = 0
    errors: list[str] = []

    async for dump in DataLoader(cfg.dumps_dir).load(
        enabled_scraper=[chain.key], files_types=[STORE.name, PRICE_FULL.name]
    ):
        path = dump.get_full_path
        try:
            if not force and db.is_file_loaded(conn, dump.file_name):
                os.remove(path)
                continue
            raw = [row async for row in converter.read(dump)]
            if dump.detected_filetype == STORE:
                rows = [r for r in map(normalize.store_row, raw) if r]
                count = db.load_stores(conn, chain, dump.file_name, dump.extracted_date, rows)
            else:
                rows = [r for r in (normalize.price_row(x, chain.chain_id) for x in raw) if r]
                # מספר הסניף נלקח מתוך ה-XML ולא משם הקובץ
                store_id = normalize.store_number(raw[0].get("storeid")) if raw else None
                if store_id is None:
                    raise ValueError("לא נמצא StoreId בקובץ")
                count = db.load_price_full(
                    conn, chain, store_id, dump.file_name, dump.extracted_date, rows
                )
            log.info("נטען %s (%d שורות)", dump.file_name, count)
            loaded += 1
            total_rows += count
            os.remove(path)
        except Exception as exc:  # pylint: disable=broad-exception-caught
            failed += 1
            errors.append(f"{dump.file_name}: {exc}")
            log.error("כשל בטעינת %s\n%s", dump.file_name, traceback.format_exc())
    return loaded, failed, total_rows, errors


def run_chain(cfg: Config, chain: Chain, store_ids: list[int] | None, force: bool = False) -> str:
    """ריצה מלאה לרשת אחת, עם רישום ב-ingest_runs. מחזיר את הסטטוס הסופי."""
    with db.connect(cfg.database_url) as conn:
        db.apply_schema(conn, cfg.schema_dir)
        db.upsert_chain(conn, chain)
        run_id = db.start_run(conn, chain)
        if force or not db.has_loaded_files(conn, chain):
            reset_download_memory(cfg, chain)
        loaded = failed = rows = 0
        errors: list[str] = []
        try:
            errors += asyncio.run(download(cfg, chain, store_ids))
            loaded, failed, rows, load_errors = asyncio.run(load_dumps(cfg, chain, conn, force))
            errors += load_errors
            if loaded == 0:
                status = "failed" if errors else "ok"   # ok בלי קבצים = אין קבצים חדשים
            else:
                status = "partial" if errors else "ok"
        except Exception as exc:  # pylint: disable=broad-exception-caught
            status = "failed"
            errors.append(str(exc))
            log.error("הריצה של %s נכשלה\n%s", chain.name, traceback.format_exc())
        db.finish_run(conn, run_id, status, loaded, failed, rows,
                      "\n".join(errors)[:4000] or None)
        log.info("%s: %s – %d קבצים נטענו, %d נכשלו, %d שורות",
                 chain.name, status, loaded, failed, rows)
        return status
