-- סכמת המסד. קבצי init רצים רק ביצירה ראשונה של ה-volume;
-- ה-ingest מריץ את אותו קובץ בכל הפעלה (כל הפקודות idempotent).
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- "רשת" = מקור נתונים אחד (scraper). מקור יכול לכלול כמה מזהי רשת (ChainId).
CREATE TABLE IF NOT EXISTS chains (
    key        text PRIMARY KEY,             -- שם ה-scraper/parser בספריות OpenIsraeliSupermarkets
    name       text NOT NULL,
    is_pharm   boolean NOT NULL DEFAULT false,
    hidden     boolean NOT NULL DEFAULT false,
    sort_order integer NOT NULL DEFAULT 100
);

CREATE TABLE IF NOT EXISTS stores (
    id             serial PRIMARY KEY,
    chain_key      text NOT NULL REFERENCES chains(key),
    chain_id       text NOT NULL,            -- ChainId מתוך הקובץ
    store_id       text NOT NULL,            -- מספר הסניף ברשת, בלי אפסים מובילים
    sub_chain_id   text,
    sub_chain_name text,
    name           text,
    address        text,
    city           text,                     -- שם יישוב (קוד למ"ס מתורגם לשם)
    zip_code       text,
    store_type     text,
    lat            double precision,
    lng            double precision,
    geocode_precision text,                  -- address / street / city / none
    geocoded_at    timestamptz,              -- NULL = עדיין לא נוסה
    updated_at     timestamptz NOT NULL DEFAULT now(),
    prices_file_time  timestamptz,           -- חותמת הזמן של קובץ המחירים האחרון שנטען
    prices_loaded_at  timestamptz,
    UNIQUE (chain_key, chain_id, store_id)
);
CREATE INDEX IF NOT EXISTS stores_geo ON stores (lat, lng) WHERE lat IS NOT NULL;

-- מוצר מזוהה לפי ברקוד בלבד. קוד פנימי של רשת (ItemType=0) שייך רק לרשת שלו
-- ולכן לא מותאם בין רשתות: internal_chain מחזיק את מפתח הרשת במקרה כזה.
CREATE TABLE IF NOT EXISTS products (
    id              serial PRIMARY KEY,
    barcode         text NOT NULL,
    internal_chain  text NOT NULL DEFAULT '',
    name            text NOT NULL,
    manufacturer    text,
    unit_qty        text,
    quantity        numeric,
    unit_of_measure text,
    is_weighted     boolean NOT NULL DEFAULT false,
    updated_at      timestamptz NOT NULL DEFAULT now(),
    UNIQUE (barcode, internal_chain)
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

-- כתובות שמורות: מחירים נטענים רק לסניפים ברדיוס סביבן
CREATE TABLE IF NOT EXISTS addresses (
    id          serial PRIMARY KEY,
    label       text NOT NULL,
    address     text NOT NULL,
    radius_km   numeric NOT NULL DEFAULT 5,
    lat         double precision,
    lng         double precision,
    geocoded_at timestamptz,                 -- NULL = ממתין ל-geocoding
    geocode_error text,
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- cache של geocoding: כל שאילתה נשלחת לשירות פעם אחת בלבד
CREATE TABLE IF NOT EXISTS geocode_cache (
    query      text PRIMARY KEY,
    lat        double precision,
    lng        double precision,             -- NULL = לא נמצא
    display_name text,
    provider   text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ingest_runs (
    id           serial PRIMARY KEY,
    chain_key    text NOT NULL REFERENCES chains(key),
    kind         text NOT NULL DEFAULT 'prices',   -- stores / prices
    started_at   timestamptz NOT NULL DEFAULT now(),
    finished_at  timestamptz,
    status       text NOT NULL DEFAULT 'running',  -- running / ok / partial / failed
    files_loaded integer NOT NULL DEFAULT 0,
    files_failed integer NOT NULL DEFAULT 0,
    rows_loaded  integer NOT NULL DEFAULT 0,
    error        text
);
CREATE INDEX IF NOT EXISTS ingest_runs_chain ON ingest_runs (chain_key, id DESC);

-- קבצים שכבר נטענו, כדי לא להוריד ולטעון אותם שוב
CREATE TABLE IF NOT EXISTS ingest_files (
    file_name  text PRIMARY KEY,
    chain_key  text NOT NULL,
    store_id   text,
    file_type  text NOT NULL,
    file_time  timestamptz,
    rows       integer,
    loaded_at  timestamptz NOT NULL DEFAULT now()
);

-- תור בקשות מהאפליקציה ל-worker של ה-ingest (למשל אחרי הוספת כתובת)
CREATE TABLE IF NOT EXISTS ingest_requests (
    id           serial PRIMARY KEY,
    kind         text NOT NULL,              -- address / stores / prices / geocode
    address_id   integer,
    requested_at timestamptz NOT NULL DEFAULT now(),
    started_at   timestamptz,
    finished_at  timestamptz,
    status       text NOT NULL DEFAULT 'pending',  -- pending / running / done / failed
    message      text
);

-- מרחק בק"מ בין שתי נקודות (haversine)
CREATE OR REPLACE FUNCTION distance_km(lat1 double precision, lng1 double precision,
                                       lat2 double precision, lng2 double precision)
RETURNS double precision LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
    SELECT 2 * 6371 * asin(sqrt(
        power(sin(radians(lat2 - lat1) / 2), 2) +
        cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
    ))
$$;
