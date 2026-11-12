"""הגדרות מתוך משתני סביבה (.env)."""
import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


def _int_list(name: str) -> list[int]:
    raw = os.environ.get(name, "")
    return [int(x) for x in raw.replace(" ", "").split(",") if x]


@dataclass(frozen=True)
class Config:
    database_url: str
    dumps_dir: str
    schema_dir: str
    ingest_all_stores: bool
    shufersal_store_ids: list[int]
    request_delay: float


def load() -> Config:
    return Config(
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql://supermarket:change-me@localhost:5432/supermarket"
        ),
        dumps_dir=os.environ.get("DUMPS_DIR", "/data/dumps"),
        schema_dir=os.environ.get("SCHEMA_DIR", "/schema"),
        ingest_all_stores=_bool("INGEST_ALL_STORES"),
        shufersal_store_ids=_int_list("SHUFERSAL_STORE_IDS"),
        request_delay=float(os.environ.get("REQUEST_DELAY_SECONDS", "1")),
    )
