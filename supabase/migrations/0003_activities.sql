-- Iron Master — activities (walks, runs, steps) logged by sentence.
-- The program asks for a walk on Wednesdays and 8–10k steps at weekends, so
-- a walk is worth more than a note. One row per bout, under its date.

create table if not exists activities (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid(),
  date        date not null,
  kind        text not null check (kind in ('walk','run','cycle','swim','steps','other')),
  minutes     int     check (minutes is null or (minutes > 0 and minutes <= 1440)),
  km          numeric check (km is null or (km > 0 and km <= 200)),
  steps       int     check (steps is null or (steps > 0 and steps <= 100000)),
  note        text,
  raw_text    text,
  logged_at   timestamptz not null default now(),
  source      text not null default 'app' check (source in ('vault','app')),
  source_path text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists activities_user_date_idx on activities (user_id, date);

drop trigger if exists activities_updated_at on activities;
create trigger activities_updated_at before update on activities
  for each row execute function set_updated_at();

alter table activities enable row level security;

drop policy if exists "own rows" on activities;
create policy "own rows" on activities
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Log entries may now carry an activity card.
alter table log_entries drop constraint if exists log_entries_kind_check;
alter table log_entries add constraint log_entries_kind_check
  check (kind in ('set','meal','weigh_in','water','activity','note','unknown'));
