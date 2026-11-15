-- בקשה לטעינה חוזרת של רשת אחת, אחרי שהטעינה שלה נכשלה
ALTER TABLE ingest_requests ADD COLUMN IF NOT EXISTS chain_key text;
