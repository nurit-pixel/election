-- מד הסלמה ישראל–איראן: תמונת מצב שעתית (אינדיקטורים, ידיעות, מחירים)
create table if not exists iran_snapshots (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  payload jsonb not null
);

create index if not exists iran_snapshots_created_at on iran_snapshots (created_at desc);

-- כמו שאר הטבלאות: חסום ל-anon, הגישה רק דרך השרת עם service role
alter table iran_snapshots enable row level security;
