-- היסטוריית הגשות: כל שליחה של "סגור את הפתק" נשמרת כתמונת מצב
create table if not exists bet_history (
  id bigint generated always as identity primary key,
  player_id uuid not null references players(id) on delete cascade,
  seats jsonb not null,
  pm text not null,
  bloc text not null,
  bonus jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists bet_history_player_idx on bet_history (player_id, created_at desc);

alter table bet_history enable row level security;
revoke all on bet_history from anon, authenticated;

-- ההימורים הקיימים נכנסים כרשומה הראשונה בהיסטוריה (פעם אחת בלבד)
insert into bet_history (player_id, seats, pm, bloc, bonus, created_at)
select b.player_id, b.seats, b.pm, b.bloc, b.bonus, coalesce(b.updated_at, b.submitted_at, now())
from bets b
where not exists (select 1 from bet_history h where h.player_id = b.player_id);
