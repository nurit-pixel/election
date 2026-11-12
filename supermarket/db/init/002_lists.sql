-- רשימות קניות. פריט ברשימה הוא מוצר אחד או קבוצת חלופות שהמשתמש הגדיר;
-- בכל סניף נלקחת החלופה הזולה.
CREATE TABLE IF NOT EXISTS lists (
    id         serial PRIMARY KEY,
    name       text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS list_items (
    id          serial PRIMARY KEY,
    list_id     integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    name        text NOT NULL,                  -- השם שמוצג ברשימה
    quantity    numeric NOT NULL DEFAULT 1,     -- יחידות, או ק"ג כש-is_weighted
    is_weighted boolean NOT NULL DEFAULT false, -- bIsWeighted=1: כמות בק"ג, מחיר לק"ג
    created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS list_items_list ON list_items (list_id);

CREATE TABLE IF NOT EXISTS list_item_products (
    item_id    integer NOT NULL REFERENCES list_items(id) ON DELETE CASCADE,
    product_id integer NOT NULL REFERENCES products(id),
    PRIMARY KEY (item_id, product_id)
);
