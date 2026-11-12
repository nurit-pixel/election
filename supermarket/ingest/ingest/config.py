"""הגדרות מתוך משתני סביבה (.env)."""
import os
from dataclasses import dataclass


def _bool(name: str, default: bool = False) -> bool:
    return os.environ.get(name, str(default)).strip().lower() in ("1", "true", "yes", "on")


@dataclass(frozen=True)
class Config:
    database_url: str
    dumps_dir: str
    schema_dir: str
    ingest_all_stores: bool
    request_delay: float
    geocoder_url: str
    geocoder_user_agent: str
    geocoder_delay: float
    max_file_age_days: int


def load() -> Config:
    return Config(
        database_url=os.environ.get(
            "DATABASE_URL", "postgresql://supermarket:change-me@localhost:5432/supermarket"
        ),
        dumps_dir=os.environ.get("DUMPS_DIR", "/data/dumps"),
        schema_dir=os.environ.get("SCHEMA_DIR", "/schema"),
        ingest_all_stores=_bool("INGEST_ALL_STORES"),
        request_delay=float(os.environ.get("REQUEST_DELAY_SECONDS", "1")),
        geocoder_url=os.environ.get("GEOCODER_URL", "https://nominatim.openstreetmap.org/search"),
        geocoder_user_agent=os.environ.get("GEOCODER_USER_AGENT", "supermarket-basket-compare/0.2"),
        geocoder_delay=float(os.environ.get("GEOCODER_DELAY_SECONDS", "1.1")),
        max_file_age_days=int(os.environ.get("MAX_FILE_AGE_DAYS", "7")),
    )
