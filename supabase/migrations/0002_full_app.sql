-- Iron Master — full app (Today, Log, Train, Meals, Recap).
-- Adds meals, a reusable meal library, the Log chat entries, water on
-- nutrition days, and live-session status. RLS on every new table.

-- Sessions can be in progress while the coach is running.
alter table sessions add column if not exists status text not null default 'done'
  check (status in ('in-progress','done'));
alter table sessions add column if not exists started_at timestamptz;
alter table sessions add column if not exists ended_at timestamptz;

-- Water intake and a note slot on nutrition days.
alter table nutrition_days add column if not exists water_ml int not null default 0;

-- ---------------------------------------------------------------------------
-- meals: one row per logged meal, under its nutrition day

create table if not exists meals (
  id                uuid primary key default gen_random_uuid(),
  nutrition_day_id  uuid not null references nutrition_days(id) on delete cascade,
  position          int  not null,
  slot              text,                  -- Breakfast, Lunch, Dinner, Shake, Snack, Evening, Supplements…
  name              text not null,
  items             jsonb not null default '[]'::jsonb, -- [{name, grams?, kcal, protein_g, fiber_g?, accuracy}]
  kcal              int  not null default 0,
  protein_g         numeric not null default 0,
  fiber_g           numeric,
  accuracy          text check (accuracy in ('label','weighed','estimated')),
  logged_at         timestamptz not null default now(),
  source            text not null default 'app' check (source in ('vault','app')),
  raw_text          text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (nutrition_day_id, position)
);

-- ---------------------------------------------------------------------------
-- meal_library: reusable meals (seeded from the Meals Nutritional Facts Sheet)

create table if not exists meal_library (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  name          text not null,
  category      text check (category in ('breakfast','shake','lunch','dinner','snack','supplement','drink','fiber')),
  portion       text,
  kcal          int  not null,
  protein_g     numeric not null,
  fiber_g       numeric,
  accuracy      text check (accuracy in ('label','weighed','estimated')),
  items         jsonb not null default '[]'::jsonb,
  notes         text,
  times_eaten   int  not null default 0,
  last_eaten    date,
  source        text not null default 'sheet' check (source in ('sheet','app')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (user_id, name)
);

-- ---------------------------------------------------------------------------
-- log_entries: the Log screen's conversation (what you said + Claude's card)

create table if not exists log_entries (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid(),
  text          text not null,
  kind          text check (kind in ('set','meal','weigh_in','water','note','unknown')),
  card          jsonb,
  status        text not null default 'pending' check (status in ('pending','saved','discarded','error')),
  saved_ref     jsonb,                      -- {table, id}
  error         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists log_entries_user_created_idx on log_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- updated_at triggers

drop trigger if exists meals_updated_at on meals;
create trigger meals_updated_at before update on meals
  for each row execute function set_updated_at();

drop trigger if exists meal_library_updated_at on meal_library;
create trigger meal_library_updated_at before update on meal_library
  for each row execute function set_updated_at();

drop trigger if exists log_entries_updated_at on log_entries;
create trigger log_entries_updated_at before update on log_entries
  for each row execute function set_updated_at();

-- ---------------------------------------------------------------------------
-- Row-level security

alter table meals         enable row level security;
alter table meal_library  enable row level security;
alter table log_entries   enable row level security;

drop policy if exists "own rows via day" on meals;
create policy "own rows via day" on meals
  for all
  using (exists (select 1 from nutrition_days d where d.id = nutrition_day_id and d.user_id = auth.uid()))
  with check (exists (select 1 from nutrition_days d where d.id = nutrition_day_id and d.user_id = auth.uid()));

drop policy if exists "own rows" on meal_library;
create policy "own rows" on meal_library
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists "own rows" on log_entries;
create policy "own rows" on log_entries
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
