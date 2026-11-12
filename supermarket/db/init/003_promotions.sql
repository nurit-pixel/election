-- מבצעים (PromoFull). כל שורה ב-promotion_items היא מוצר אחד במבצע אחד בסניף אחד,
-- עם השדות הגולמיים מהקובץ; חישוב המבצע עצמו נעשה באפליקציה (web/lib/promos.ts).
CREATE TABLE IF NOT EXISTS promotions (
    id            bigserial PRIMARY KEY,
    store_pk      integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    promotion_id  text NOT NULL,
    description   text,
    start_at      timestamptz,
    end_at        timestamptz,
    club_ids      integer[] NOT NULL DEFAULT '{}',  -- ריק = כלל הלקוחות (ClubId 0)
    club_text     text,
    min_purchase  numeric,            -- MinPurchaseAmnt: מבצע כזה לא מחושב, רק מוצג כהערה
    restricted    boolean NOT NULL DEFAULT false,   -- מוגבל לשעות/ימים, או מבנה שלא ניתן לחישוב
    nth_n         integer,            -- "הנחה על הפריט ה-N": כל פריט N-י...
    nth_rate      numeric,            -- ...בהנחה של nth_rate אחוזים (1+1 = פריט שני ב-100%)
    file_time     timestamptz NOT NULL
);
CREATE INDEX IF NOT EXISTS promotions_store ON promotions (store_pk);

CREATE TABLE IF NOT EXISTS promotion_items (
    promotion_pk     bigint NOT NULL REFERENCES promotions(id) ON DELETE CASCADE,
    store_pk         integer NOT NULL,
    product_id       integer NOT NULL REFERENCES products(id),
    reward_type      text,
    min_qty          numeric,
    max_qty          numeric,
    discounted_price numeric,
    discount_rate    numeric,
    PRIMARY KEY (promotion_pk, product_id)
);
CREATE INDEX IF NOT EXISTS promotion_items_lookup ON promotion_items (store_pk, product_id);

ALTER TABLE stores ADD COLUMN IF NOT EXISTS promos_file_time timestamptz;

-- מועדוני לקוחות שנמצאו בקבצי המבצעים. member = המשתמש סימן שהוא חבר (מסך ההגדרות).
CREATE TABLE IF NOT EXISTS clubs (
    chain_key text NOT NULL REFERENCES chains(key),
    club_id   integer NOT NULL,
    name      text NOT NULL,
    member    boolean NOT NULL DEFAULT false,
    PRIMARY KEY (chain_key, club_id)
);
