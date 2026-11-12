-- סכמת בסיס (שלב 1). קבצי init רצים רק ביצירה ראשונה של ה-volume;
-- ה-ingest מריץ את אותו קובץ בכל הפעלה (כל הפקודות idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TABLE IF NOT EXISTS chains (
    chain_id     text PRIMARY KEY,           -- מזהה הרשת בקבצים (13 ספרות)
    scraper_name text NOT NULL,              -- שם ה-scraper בספריית il-supermarket-scraper
    name         text NOT NULL,
    is_pharm     boolean NOT NULL DEFAULT false,
    hidden       boolean NOT NULL DEFAULT false
);

CREATE TABLE IF NOT EXISTS stores (
    id             serial PRIMARY KEY,
    chain_id       text NOT NULL REFERENCES chains(chain_id),
    store_id       text NOT NULL,            -- מספר הסניף ברשת, בלי אפסים מובילים
    sub_chain_id   text,
    sub_chain_name text,
    name           text,
    address        text,
    city           text,
    zip_code       text,
    store_type     text,
    lat            double precision,
    lng            double precision,
    geocoded_at    timestamptz,
    updated_at     timestamptz NOT NULL DEFAULT now(),
    prices_file_time  timestamptz,           -- חותמת הזמן של קובץ המחירים האחרון שנטען
    prices_loaded_at  timestamptz,
    UNIQUE (chain_id, store_id)
);

-- מוצר מזוהה לפי ברקוד בלבד. קוד פנימי של רשת (ItemType=0) שייך רק לרשת שלו
-- ולכן לא מותאם בין רשתות: internal_chain_id מחזיק את מזהה הרשת במקרה כזה.
CREATE TABLE IF NOT EXISTS products (
    id                serial PRIMARY KEY,
    barcode           text NOT NULL,
    internal_chain_id text NOT NULL DEFAULT '',
    name              text NOT NULL,
    manufacturer      text,
    unit_qty          text,
    quantity          numeric,
    unit_of_measure   text,
    is_weighted       boolean NOT NULL DEFAULT false,
    updated_at        timestamptz NOT NULL DEFAULT now(),
    UNIQUE (barcode, internal_chain_id)
);
CREATE INDEX IF NOT EXISTS products_name_trgm ON products USING gin (name gin_trgm_ops);

CREATE TABLE IF NOT EXISTS prices (
    store_pk          integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    product_id        integer NOT NULL REFERENCES products(id),
    price             numeric(10,2) NOT NULL,   -- bIsWeighted=1: מחיר לק"ג
    unit_price        numeric(10,2),
    is_weighted       boolean NOT NULL DEFAULT false,
    allow_discount    boolean,
    price_update_time timestamptz,              -- מתי הרשת עדכנה את המחיר
    file_time         timestamptz NOT NULL,     -- חותמת הזמן של הקובץ שממנו נטען
    PRIMARY KEY (store_pk, product_id)
);
CREATE INDEX IF NOT EXISTS prices_product ON prices (product_id);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id           serial PRIMARY KEY,
    chain_id     text NOT NULL REFERENCES chains(chain_id),
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    status       text NOT NULL DEFAULT 'running',  -- running / ok / partial / failed
    files_loaded integer NOT NULL DEFAULT 0,
    files_failed integer NOT NULL DEFAULT 0,
    rows_loaded  integer NOT NULL DEFAULT 0,
    error        text
);

-- קבצים שכבר נטענו, כדי לא לטעון אותם שוב
CREATE TABLE IF NOT EXISTS ingest_files (
    file_name  text PRIMARY KEY,
    chain_id   text NOT NULL,
    store_id   text,
    file_type  text NOT NULL,
    file_time  timestamptz,
    rows       integer,
    loaded_at  timestamptz NOT NULL DEFAULT now()
);
