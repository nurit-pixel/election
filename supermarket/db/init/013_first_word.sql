-- חלופה זולה: חיפוש מוצרים לפי המילה הראשונה בשם, בלי לסרוק את כל טבלת המוצרים
CREATE INDEX IF NOT EXISTS products_first_word ON products (split_part(name, ' ', 1)) WHERE internal_chain = '';
