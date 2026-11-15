-- חלופות: מותגי הבית של הרשתות (קוד פנימי) נכללים גם הם בחיפוש מוצרים דומים
CREATE INDEX IF NOT EXISTS products_first_word_any ON products (split_part(name, ' ', 1));

-- פריט "כל מותג": בחישוב הסל נכללים אוטומטית מוצרים דומים ממותגים אחרים, באותו גודל
ALTER TABLE list_items ADD COLUMN IF NOT EXISTS any_brand boolean NOT NULL DEFAULT false;

-- "לא דומה": מוצר שהמשתמש סימן שאינו חלופה למוצר מסוים, ולא יוצע לו שוב
CREATE TABLE IF NOT EXISTS dismissed_alternatives (
  user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  alternative_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, product_id, alternative_id)
);
