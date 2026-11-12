"""ממשק שורת פקודה:

    python -m ingest worker                        # תהליך הרקע (ברירת המחדל ב-Docker)
    python -m ingest stores [--chain KEY ...]      # רשימות סניפים
    python -m ingest geocode [--limit N]           # geocoding לסניפים שעוד לא נוסו
    python -m ingest prices [--chain KEY ...]      # מחירים לסניפים ברדיוס הכתובות השמורות
    python -m ingest prices --chain SHUFERSAL --stores 1,2,3
    python -m ingest prices --all-stores           # כל הארץ (כמו INGEST_ALL_STORES=true)
    python -m ingest address "בית" "הרצל 1, תל אביב" [--radius 5]
    python -m ingest status
"""
import argparse
import logging
import sys

from . import config, db, geocode
from .chains import CHAINS


def main() -> int:
    parser = argparse.ArgumentParser(prog="ingest")
    sub = parser.add_subparsers(dest="command", required=True)
    sub.add_parser("worker", help="תהליך רקע שמטפל בבקשות מהאפליקציה")
    for name, text in (("stores", "הורדת רשימות סניפים"), ("prices", "הורדת מחירים")):
        p = sub.add_parser(name, help=text)
        p.add_argument("--chain", action="append", choices=sorted(CHAINS),
                       help="רשת (אפשר כמה פעמים). ברירת מחדל: כל הרשתות")
        p.add_argument("--force", action="store_true", help="לטעון מחדש גם קבצים שכבר נטענו")
        if name == "prices":
            p.add_argument("--stores", help="מספרי סניפים מופרדים בפסיקים (עם --chain אחת)")
            p.add_argument("--all-stores", action="store_true", help="כל הסניפים בארץ")
    g = sub.add_parser("geocode", help="geocoding לסניפים")
    g.add_argument("--limit", type=int)
    a = sub.add_parser("address", help="הוספת כתובת שמורה")
    a.add_argument("label")
    a.add_argument("address")
    a.add_argument("--radius", type=float, default=5)
    sub.add_parser("status", help="מצב הטעינה לכל רשת")
    args = parser.parse_args()

    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    cfg = config.load()

    if args.command == "worker":
        from . import worker
        worker.run(cfg)
        return 0

    with db.connect(cfg.database_url) as conn:
        db.apply_schema(conn, cfg.schema_dir)

        if args.command == "status":
            for name, kind, status, started, loaded, failed, rows, error in conn.execute(
                """SELECT c.name, r.kind, r.status, r.started_at, r.files_loaded, r.files_failed,
                          r.rows_loaded, r.error
                   FROM chains c
                   JOIN LATERAL (SELECT DISTINCT ON (kind) * FROM ingest_runs
                                 WHERE chain_key = c.key ORDER BY kind, id DESC) r ON true
                   ORDER BY c.sort_order, r.kind DESC"""
            ):
                print(f"{started:%d.%m %H:%M} {name} [{kind}] {status}: {loaded} קבצים, "
                      f"{failed} כשלים, {rows} שורות" + (f" | {error[:150]}" if error else ""))
            return 0

        if args.command == "geocode":
            geocode.geocode_addresses(cfg, conn)
            print(f"טופלו {geocode.geocode_stores(cfg, conn, args.limit)} סניפים")
            return 0

        if args.command == "address":
            address_id = conn.execute(
                "INSERT INTO addresses (label, address, radius_km) VALUES (%s, %s, %s) RETURNING id",
                (args.label, args.address, args.radius),
            ).fetchone()[0]
            from . import worker
            worker.enqueue(conn, "address", address_id)
            print(f"הכתובת נוספה (מזהה {address_id}); ה-worker יטען את הסניפים שלידה")
            return 0

        from . import pipeline  # ייבוא מאוחר: הספריות כבדות
        chains = [CHAINS[k] for k in (args.chain or CHAINS)]
        if args.command == "stores":
            statuses = pipeline.refresh_stores(cfg, conn, chains, args.force)
        elif args.stores:
            if len(chains) != 1:
                print("--stores דורש --chain אחת בדיוק", file=sys.stderr)
                return 2
            ids = [s.strip().lstrip("0") or "0" for s in args.stores.split(",") if s.strip()]
            statuses = {chains[0].key: pipeline.run_chain(cfg, conn, chains[0], "prices", ids,
                                                          args.force)}
        else:
            geocode.geocode_addresses(cfg, conn)
            statuses = pipeline.refresh_prices(
                cfg, conn, chains, all_stores=args.all_stores or cfg.ingest_all_stores,
                force=args.force)
        failed = [k for k, s in statuses.items() if s == "failed"]
        print(f"הסתיים: {len(statuses) - len(failed)} רשתות הצליחו, {len(failed)} נכשלו"
              + (f" ({', '.join(failed)})" if failed else ""))
        return 0


if __name__ == "__main__":
    sys.exit(main())
