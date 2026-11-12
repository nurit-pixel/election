"""ממשק שורת פקודה:

    python -m ingest run --chain SHUFERSAL                 # לפי ההגדרות ב-.env
    python -m ingest run --chain SHUFERSAL --stores 1,2,3  # סניפים מסוימים
    python -m ingest run --chain SHUFERSAL --all-stores    # כל הארץ
    python -m ingest run --chain SHUFERSAL --force         # הורדה מחדש של הכול
    python -m ingest status                                # ריצות אחרונות
"""
import argparse
import logging
import sys

from . import config, db
from .chains import CHAINS


def main() -> int:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="הורדה וטעינה")
    run.add_argument("--chain", action="append", choices=sorted(CHAINS),
                     help="רשת לטעינה (אפשר כמה פעמים). ברירת מחדל: כל הרשתות")
    run.add_argument("--stores", help="מספרי סניפים מופרדים בפסיקים")
    run.add_argument("--all-stores", action="store_true", help="כל הסניפים בארץ")
    run.add_argument("--force", action="store_true",
                     help="להוריד ולטעון מחדש גם קבצים שכבר טופלו")
    sub.add_parser("status", help="הצגת הריצות האחרונות")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = config.load()

    if args.command == "status":
        with db.connect(cfg.database_url) as conn:
            rows = conn.execute(
                """SELECT c.name, r.status, r.started_at, r.finished_at, r.files_loaded,
                          r.files_failed, r.rows_loaded, r.error
                   FROM ingest_runs r JOIN chains c USING (chain_id)
                   ORDER BY r.id DESC LIMIT 20"""
            ).fetchall()
        for name, status, started, finished, loaded, failed, n, error in rows:
            print(f"{started:%Y-%m-%d %H:%M} {name} {status}: "
                  f"{loaded} קבצים, {failed} כשלים, {n} שורות" + (f" | {error}" if error else ""))
        return 0

    from .pipeline import run_chain  # ייבוא מאוחר: הספריות כבדות

    if args.all_stores or (cfg.ingest_all_stores and not args.stores):
        store_ids = None
    elif args.stores:
        store_ids = [int(s) for s in args.stores.split(",") if s.strip()]
    else:
        store_ids = cfg.shufersal_store_ids
        if not store_ids:
            print("לא הוגדרו סניפים: הגדירו SHUFERSAL_STORE_IDS או INGEST_ALL_STORES=true",
                  file=sys.stderr)
            return 2

    statuses = []
    for key in args.chain or sorted(CHAINS):
        # כשל ברשת אחת לא עוצר את השאר
        statuses.append(run_chain(cfg, CHAINS[key], store_ids, force=args.force))
    return 0 if all(s in ("ok", "partial") for s in statuses) else 1


if __name__ == "__main__":
    sys.exit(main())
