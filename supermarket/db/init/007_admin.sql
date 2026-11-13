-- יומן אירועים למסך הניהול: כניסות ושגיאות של האפליקציה.
CREATE TABLE IF NOT EXISTS app_log (
    id      bigserial PRIMARY KEY,
    at      timestamptz NOT NULL DEFAULT now(),
    level   text NOT NULL,          -- info / error
    kind    text NOT NULL,          -- login, login_failed, server_error, receipt_failed ...
    user_id integer REFERENCES users(id) ON DELETE SET NULL,
    message text NOT NULL,
    details text
);
CREATE INDEX IF NOT EXISTS app_log_at ON app_log (at DESC);
CREATE INDEX IF NOT EXISTS app_log_errors ON app_log (at DESC) WHERE level = 'error';
