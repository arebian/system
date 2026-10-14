-- Keep foreign-key checks on timer sessions fast as the workout history grows.
-- These are deliberately separate from the user/session lookup indexes used by
-- the runtime RPCs above.
create index if not exists workout_timer_sessions_workout_id_idx
  on public.workout_timer_sessions (workout_id);

create index if not exists workout_timer_sessions_completed_workout_session_id_idx
  on public.workout_timer_sessions (completed_workout_session_id);
