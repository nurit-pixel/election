-- ליל המדגמים: משתמשים עם קוד אישי, קבוצות, שאלות בונוס לקבוצה.
-- בטוח להריץ יותר מפעם אחת.

-- ── קוד אישי (4 ספרות, שמור כ-hash) + חסימה אחרי ניסיונות שגויים ──
alter table players add column if not exists pin_hash text;
alter table players add column if not exists failed_attempts int not null default 0;
alter table players add column if not exists locked_until timestamptz;

-- שם משתמש ייחודי בלי תלות באותיות גדולות/קטנות (לשמות לועזיים)
create unique index if not exists players_name_lower_idx on players (lower(name));

-- ── קבוצות ──
create table if not exists groups (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,                 -- קוד ההזמנה בקישור /g/<slug>
  name text not null,
  emoji text not null default '🗳️',
  color text not null default '#22d3ee',
  is_public boolean not null default false,  -- פתוחה = מופיעה ברשימה הציבורית
  owner_id uuid references players(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists group_members (
  group_id uuid not null references groups(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, player_id)
);
create index if not exists group_members_player_idx on group_members (player_id);

-- שאלות בונוס של קבוצה (אם יש — הן מחליפות את 5 שאלות הבונוס הכלליות בדירוג הקבוצה)
create table if not exists group_questions (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references groups(id) on delete cascade,
  position int not null,
  text text not null,
  answer boolean,                            -- התשובה הנכונה; המנהל/ת מזין/ה בסוף
  unique (group_id, position)
);

create table if not exists group_answers (
  question_id uuid not null references group_questions(id) on delete cascade,
  player_id uuid not null references players(id) on delete cascade,
  answer boolean not null,
  updated_at timestamptz not null default now(),
  primary key (question_id, player_id)
);

alter table groups          enable row level security;
alter table group_members   enable row level security;
alter table group_questions enable row level security;
alter table group_answers   enable row level security;
revoke all on groups, group_members, group_questions, group_answers from anon, authenticated;

-- ── המשרד הופך לקבוצה הראשונה, עם כל מי שכבר שיחק ──
insert into groups (slug, name, emoji, color, is_public, owner_id)
select 'koach43', 'מטה המאבק כוח 43', '🏢', '#ff2d55', false,
       (select id from players where name = 'נורית' limit 1)
where not exists (select 1 from groups where slug = 'koach43');

insert into group_members (group_id, player_id, joined_at)
select g.id, p.id, p.created_at
from groups g cross join players p
where g.slug = 'koach43'
on conflict do nothing;
