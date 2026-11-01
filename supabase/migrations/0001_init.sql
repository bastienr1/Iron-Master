-- Iron Master — Sprint 1 foundation schema.
-- Every table is owned by a user_id and locked down with row-level security:
-- a row is visible and writable only by its owner. session_exercises inherits
-- ownership through its session.
--
-- To run inside a dedicated schema instead of public, prepend:
--   create schema if not exists iron;  set search_path to iron, public;
-- and expose `iron` in the project's API settings.

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- program_slots: the program as data (seeded from supabase/seed/program.ts)

create table if not exists program_slots (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  day           text not null check (day in ('upper_a','lower_a','upper_b','lower_b')),
  position      int  not null,
  exercise_key  text not null,
  sets          int  not null,
  rep_min       int  not null,
  rep_max       int  not null,
  per_side      boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, day, position)
);

-- ---------------------------------------------------------------------------
-- sessions: one per workout

create table if not exists sessions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  date          date not null,
  day           text not null check (day in ('upper_a','lower_a','upper_b','lower_b')),
  source        text not null check (source in ('vault','app')),
  source_path   text,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date, day)
);

-- ---------------------------------------------------------------------------
-- session_exercises: one row per lift in a session.
-- logged_* = what the note says; verdict / next_load_text = the engine's call.

create table if not exists session_exercises (
  id               uuid primary key default gen_random_uuid(),
  session_id       uuid not null references sessions(id) on delete cascade,
  position         int  not null,
  exercise_key     text not null,
  raw_name         text,
  load_text        text,
  load_kg          numeric,
  implements       int  not null default 1,
  sets             jsonb not null default '[]'::jsonb,  -- [{reps:int, load_kg?:number, rest_pause?:bool}]
  programmed_sets  int,
  rep_min          int,
  rep_max          int,
  target_reps      int,
  logged_verdict   text check (logged_verdict in ('push','stay')),
  logged_next      text,
  next_aim         int,
  verdict          text check (verdict in ('push','stay','progress_bw')),
  next_load_text   text,
  reason           text,
  above_range      boolean,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (session_id, position)
);

create index if not exists session_exercises_exercise_key_idx on session_exercises (exercise_key);

-- ---------------------------------------------------------------------------
-- nutrition_days: frontmatter totals only this sprint; meals arrive in Sprint 4

create table if not exists nutrition_days (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  date          date not null,
  training      text,
  kcal          int,
  protein_g     int,
  fiber_g       int,
  sleep_h       numeric,
  status        text check (status in ('in-progress','done')),
  source_path   text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- weigh_ins: empty for now; exists so Sprint 6 needs no migration

create table if not exists weigh_ins (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  date          date not null,
  kg            numeric not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, date)
);

-- ---------------------------------------------------------------------------
-- updated_at triggers

drop trigger if exists program_slots_updated_at on program_slots;
create trigger program_slots_updated_at before update on program_slots
  for each row execute function set_updated_at();

drop trigger if exists sessions_updated_at on sessions;
create trigger sessions_updated_at before update on sessions
  for each row execute function set_updated_at();

drop trigger if exists session_exercises_updated_at on session_exercises;
create trigger session_exercises_updated_at before update on session_exercises
  for each row execute function set_updated_at();

drop trigger if exists nutrition_days_updated_at on nutrition_days;
create trigger nutrition_days_updated_at before update on nutrition_days
  for each row execute function set_updated_at();

drop trigger if exists weigh_ins_updated_at on weigh_ins;
create trigger weigh_ins_updated_at before update on weigh_ins
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security

alter table program_slots      enable row level security;
alter table sessions           enable row level security;
alter table session_exercises  enable row level security;
alter table nutrition_days     enable row level security;
alter table weigh_ins          enable row level security;

drop policy if exists "own rows" on program_slots;
create policy "own rows" on program_slots
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on sessions;
create policy "own rows" on sessions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on nutrition_days;
create policy "own rows" on nutrition_days
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on weigh_ins;
create policy "own rows" on weigh_ins
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows via session" on session_exercises;
create policy "own rows via session" on session_exercises
  for all
  using (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()))
  with check (exists (select 1 from sessions s where s.id = session_id and s.user_id = auth.uid()));
