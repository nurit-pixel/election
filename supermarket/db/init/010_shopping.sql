-- מצב קנייה: פריט שסומן כ"בעגלה". משותף לכל השותפים ברשימה.
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS checked_at timestamptz;
