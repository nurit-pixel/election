-- הגדרות כלליות של האפליקציה (מפתח/ערך)
CREATE TABLE IF NOT EXISTS app_settings (
    key   text PRIMARY KEY,
    value text NOT NULL
);
