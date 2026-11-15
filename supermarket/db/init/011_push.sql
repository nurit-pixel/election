-- התראות לטלפון (Web Push): המנויים של כל משתמש, ואילו התראות כבר נשלחו
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id         serial PRIMARY KEY,
    user_id    integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    endpoint   text NOT NULL UNIQUE,
    p256dh     text NOT NULL,
    auth       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS push_subscriptions_user ON push_subscriptions (user_id);
ALTER TABLE alerts ADD COLUMN IF NOT EXISTS pushed_at timestamptz;
