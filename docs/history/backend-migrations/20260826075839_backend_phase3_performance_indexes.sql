create index if not exists quest_penalty_events_quest_idx on public.quest_penalty_events(user_quest_id);
create index if not exists routine_checkins_user_idx on public.routine_checkins(user_id);
create index if not exists quest_penalty_events_user_idx on public.quest_penalty_events(user_id);
