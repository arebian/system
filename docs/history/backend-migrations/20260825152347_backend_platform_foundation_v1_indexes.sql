create index if not exists gps_sessions_quest_id_idx on public.gps_sessions(quest_id) where quest_id is not null;
create index if not exists gps_sessions_workout_session_id_idx on public.gps_sessions(workout_session_id) where workout_session_id is not null;
create index if not exists system_intelligence_threads_user_id_idx on public.system_intelligence_threads(user_id, updated_at desc);
create index if not exists system_intelligence_messages_user_id_idx on public.system_intelligence_messages(user_id, created_at desc);
