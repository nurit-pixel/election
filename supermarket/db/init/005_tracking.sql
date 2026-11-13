-- מעקב מחירים והתראות.

-- מוצרים במעקב, עם מחיר יעד אופציונלי
CREATE TABLE IF NOT EXISTS tracked_products (
    product_id   integer PRIMARY KEY REFERENCES products(id),
    target_price numeric,
    created_at   timestamptz NOT NULL DEFAULT now()
);

-- היסטוריה יומית, רק למוצרים במעקב ולמוצרים שברשימות שמורות.
-- day הוא התאריך של קובץ המחירים שממנו נלקח המחיר.
CREATE TABLE IF NOT EXISTS price_history (
    product_id integer NOT NULL REFERENCES products(id),
    store_pk   integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    day        date NOT NULL,
    price      numeric(10,2) NOT NULL,
    PRIMARY KEY (product_id, store_pk, day)
);
CREATE INDEX IF NOT EXISTS price_history_day ON price_history (day);

-- התראה אחת לכל מוצר, רשת, סוג ויום (לפי המחיר הזול ברשת בסניפים שברדיוס)
CREATE TABLE IF NOT EXISTS alerts (
    id         serial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES products(id),
    chain_key  text NOT NULL REFERENCES chains(key),
    store_pk   integer REFERENCES stores(id) ON DELETE SET NULL,  -- הסניף הזול ברשת
    kind       text NOT NULL,          -- change = שינוי של 10% ומעלה, target = ירידה מתחת למחיר היעד
    day        date NOT NULL,
    old_price  numeric(10,2),
    new_price  numeric(10,2) NOT NULL,
    pct        numeric,                -- אחוז השינוי (שלילי = ירידה)
    target_price numeric,
    created_at timestamptz NOT NULL DEFAULT now(),
    read_at    timestamptz,
    emailed_at timestamptz,
    UNIQUE (product_id, chain_key, kind, day)
);
CREATE INDEX IF NOT EXISTS alerts_unread ON alerts (created_at DESC) WHERE read_at IS NULL;
