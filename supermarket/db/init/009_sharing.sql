-- רשימה משותפת: בעל הרשימה (lists.user_id) מזמין משתמשים נוספים לפי מייל.
CREATE TABLE IF NOT EXISTS list_members (
    list_id  integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    user_id  integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    added_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (list_id, user_id)
);
CREATE INDEX IF NOT EXISTS list_members_user ON list_members (user_id);

-- הזמנה למייל שעוד לא נכנס לאפליקציה; הופכת לחברות בכניסה הראשונה שלו
CREATE TABLE IF NOT EXISTS list_invites (
    list_id    integer NOT NULL REFERENCES lists(id) ON DELETE CASCADE,
    email      text NOT NULL,
    invited_by integer REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS list_invites_unique ON list_invites (list_id, lower(email));
