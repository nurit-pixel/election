-- מטה המאבק כוח 43 — סכמה ראשונית
create extension if not exists pgcrypto;

create table players (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- שם פרטי או כינוי. זה כל מה ששומרים על האדם
  created_at timestamptz default now()
);

create table bets (
  player_id uuid primary key references players(id) on delete cascade,
  seats jsonb not null,               -- {"likud": 30, "beyachad": 24, ...} כל המפלגות, 0 = לא עוברת
  pm text not null,                   -- party_key / "other:<free text>" / "none"
  bloc text not null check (bloc in ('coalition','opposition')),
  bonus jsonb not null,               -- {"b1": true, "b2": false, ...}
  submitted_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table results (
  id int primary key default 1 check (id = 1),   -- שורה אחת
  seats jsonb, pm text, bloc text, bonus jsonb,
  mode text not null default 'none' check (mode in ('none','exit_poll','official')),
  lock_override timestamptz,          -- אם מוגדר, דורס את LOCK_AT (נעל = now(), פתח = עתיד רחוק)
  updated_at timestamptz default now()
);

insert into results (id) values (1) on conflict do nothing;

create table scores (
  player_id uuid primary key references players(id) on delete cascade,
  total int not null, seat_pts int, pm_pts int, bloc_pts int, bonus_pts int,
  exact_hits int,                     -- כמה מפלגות "בול" (שובר שוויון)
  computed_at timestamptz default now()
);

-- RLS: חסום ל-anon/authenticated. כל הגישה דרך ה-API עם service role (שעוקף RLS).
alter table players enable row level security;
alter table bets    enable row level security;
alter table results enable row level security;
alter table scores  enable row level security;

revoke all on players, bets, results, scores from anon, authenticated;
