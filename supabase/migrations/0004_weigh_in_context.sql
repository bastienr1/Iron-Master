-- Iron Master — several weigh-ins on one day.
-- The bodyweight trend wants the fasted morning reading. A reading taken after
-- breakfast or after the workout is worth keeping but must never replace it,
-- so a day may now hold one row per context instead of one row in total.
-- Every row logged so far was a morning reading, hence the default.

alter table weigh_ins
  add column if not exists context text not null default 'fasted'
  check (context in ('fasted','pre_workout','post_workout','other'));

alter table weigh_ins drop constraint if exists weigh_ins_user_id_date_key;
alter table weigh_ins drop constraint if exists weigh_ins_user_id_date_context_key;
alter table weigh_ins add constraint weigh_ins_user_id_date_context_key unique (user_id, date, context);
