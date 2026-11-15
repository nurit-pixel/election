-- חוות דעת של משתמשים על סניפים: דירוג 1–5 והערה קצרה. אחת לכל משתמש וסניף.
CREATE TABLE IF NOT EXISTS store_reviews (
    id         serial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    store_pk   integer NOT NULL REFERENCES stores(id) ON DELETE CASCADE,
    rating     smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment    text,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (user_id, store_pk)
);
CREATE INDEX IF NOT EXISTS store_reviews_store ON store_reviews (store_pk);
CREATE INDEX IF NOT EXISTS store_reviews_recent ON store_reviews (updated_at DESC);
