-- משתמשים (כניסה עם חשבון Google). לכל משתמש רשימות, כתובות, מועדונים, הגדרות, מעקב והתראות משלו.
CREATE TABLE IF NOT EXISTS users (
    id         serial PRIMARY KEY,
    google_sub text NOT NULL UNIQUE,      -- המזהה הקבוע של החשבון ב-Google
    email      text NOT NULL,
    name       text,
    created_at timestamptz NOT NULL DEFAULT now(),
    last_login timestamptz NOT NULL DEFAULT now()
);

-- user_id ריק = נתונים מלפני הכניסה עם Google; המשתמש הראשון שנכנס מקבל אותם.
ALTER TABLE lists     ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS lists_user ON lists (user_id);
CREATE INDEX IF NOT EXISTS addresses_user ON addresses (user_id);

-- מעקב: מוצר יכול להיות במעקב אצל כמה משתמשים, כל אחד עם מחיר יעד משלו
ALTER TABLE tracked_products ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE tracked_products DROP CONSTRAINT IF EXISTS tracked_products_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS tracked_products_user ON tracked_products (user_id, product_id);

-- התראות: לכל משתמש לפי הסניפים שברדיוס שלו
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS user_id integer REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE alerts DROP CONSTRAINT IF EXISTS alerts_product_id_chain_key_kind_day_key;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_user_unique ON alerts (user_id, product_id, chain_key, kind, day);

-- מועדוני הלקוחות שהמשתמש חבר בהם (במקום clubs.member)
CREATE TABLE IF NOT EXISTS user_clubs (
    user_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain_key text NOT NULL,
    club_id   integer NOT NULL,
    PRIMARY KEY (user_id, chain_key, club_id)
);

-- רשתות שהמשתמש הסתיר מההשוואה (במקום chains.hidden)
CREATE TABLE IF NOT EXISTS user_hidden_chains (
    user_id   integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    chain_key text NOT NULL REFERENCES chains(key) ON DELETE CASCADE,
    PRIMARY KEY (user_id, chain_key)
);

-- הגדרות אישיות (מפתח/ערך), למשל סף החיסכון לפיצול
CREATE TABLE IF NOT EXISTS user_settings (
    user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    key     text NOT NULL,
    value   text NOT NULL,
    PRIMARY KEY (user_id, key)
);

-- המקום שזוהה לכתובת (להצגה למשתמש), והאם הזיהוי משוער (רק הרחוב או רק העיר)
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS located_name text;
ALTER TABLE addresses ADD COLUMN IF NOT EXISTS approximate boolean NOT NULL DEFAULT false;
