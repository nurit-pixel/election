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
    alert_change_pct: float
    smtp_host: str
    smtp_port: int
    smtp_user: str
    smtp_password: str
    smtp_from: str
    smtp_starttls: bool
    app_url: str
    nightly_time: str
    retention_days: int


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
        geocoder_delay=float(os.environ.get("GEOCODER_DELAY_SECONDS", "1.5")),
        max_file_age_days=int(os.environ.get("MAX_FILE_AGE_DAYS", "7")),
        alert_change_pct=float(os.environ.get("ALERT_CHANGE_PCT", "10")),
        smtp_host=os.environ.get("SMTP_HOST", ""),
        smtp_port=int(os.environ.get("SMTP_PORT") or 587),
        smtp_user=os.environ.get("SMTP_USER", ""),
        smtp_password=os.environ.get("SMTP_PASSWORD", ""),
        smtp_from=os.environ.get("SMTP_FROM", ""),
        smtp_starttls=_bool("SMTP_STARTTLS", True),
        app_url=os.environ.get("APP_URL", ""),
        nightly_time=os.environ.get("NIGHTLY_TIME", "06:00"),
        retention_days=int(os.environ.get("RETENTION_DAYS", "60")),
    )
