-- Iron Master — deload weeks.
-- The program deloads every 5th week: half the sets, lighter loads, nothing
-- near failure. A session logged in that week must not become the record the
-- coach prescribes from afterwards, so each session carries a `deload` flag
-- and the weeks themselves live in a small table the user (or Claude) fills.
-- The first one is week 5 of the lean bulk, 16–22 Nov 2026.

alter table sessions
  add column if not exists deload boolean not null default false;

create table if not exists deload_weeks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  week_start  date not null,          -- the Monday
  note        text,
  created_at  timestamptz not null default now(),
  unique (user_id, week_start)
);

alter table deload_weeks enable row level security;

drop policy if exists "own rows" on deload_weeks;
create policy "own rows" on deload_weeks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
