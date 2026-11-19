-- API roles never need DDL-level table privileges. RLS does not protect
-- TRUNCATE, so remove these grants from current and future postgres-owned tables.
revoke truncate, references, trigger on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, references, trigger on tables from anon, authenticated;

-- These ledgers are backend-authored. Players may read their own history,
-- but cannot forge, rewrite or erase it through direct table access.
drop policy if exists progression_events_delete_own on public.progression_events;
drop policy if exists journey_events_delete_own on public.journey_events;
drop policy if exists boss_damage_events_insert_own on public.boss_damage_events;
drop policy if exists boss_damage_events_update_own on public.boss_damage_events;
drop policy if exists boss_damage_events_delete_own on public.boss_damage_events;

revoke insert, update, delete on public.progression_events from anon, authenticated;
revoke insert, update, delete on public.journey_events from anon, authenticated;
revoke insert, update, delete on public.boss_damage_events from anon, authenticated;
