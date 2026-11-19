-- Core progression, quest, reward, review and profile state is backend-authored.
-- API clients retain SELECT where owner-scoped policies exist, but no direct DML.
drop policy if exists profiles_delete_own on public.profiles;

revoke insert, update, delete on public.profiles from anon, authenticated;
revoke insert, update, delete on public.attributes from anon, authenticated;
revoke insert, update, delete on public.attribute_credit_allocations from anon, authenticated;
revoke insert, update, delete on public.attribute_credit_ledger from anon, authenticated;
revoke insert, update, delete on public.boss_damage_events from anon, authenticated;
revoke insert, update, delete on public.boss_quest_objectives from anon, authenticated;
revoke insert, update, delete on public.boss_quests from anon, authenticated;
revoke insert, update, delete on public.class_special_sessions from anon, authenticated;
revoke insert, update, delete on public.goals from anon, authenticated;
revoke insert, update, delete on public.gps_sessions from anon, authenticated;
revoke insert, update, delete on public.journey_events from anon, authenticated;
revoke insert, update, delete on public.learning_records from anon, authenticated;
revoke insert, update, delete on public.mage_reading_sessions from anon, authenticated;
revoke insert, update, delete on public.performance_logs from anon, authenticated;
revoke insert, update, delete on public.progression_events from anon, authenticated;
revoke insert, update, delete on public.proof_records from anon, authenticated;
revoke insert, update, delete on public.quest_penalty_events from anon, authenticated;
revoke insert, update, delete on public.rewards from anon, authenticated;
revoke insert, update, delete on public.routine_checkins from anon, authenticated;
revoke insert, update, delete on public.security_events from anon, authenticated;
revoke insert, update, delete on public.skill_attempts from anon, authenticated;
revoke insert, update, delete on public.system_action_receipts from anon, authenticated;
revoke insert, update, delete on public.system_quest_reviews from anon, authenticated;
revoke insert, update, delete on public.system_weekly_boss_plans from anon, authenticated;
revoke insert, update, delete on public.user_achievements from anon, authenticated;
revoke insert, update, delete on public.user_inventory from anon, authenticated;
revoke insert, update, delete on public.user_mage_books from anon, authenticated;
revoke insert, update, delete on public.user_pillar_progress from anon, authenticated;
revoke insert, update, delete on public.user_quest_objective_timer_sessions from anon, authenticated;
revoke insert, update, delete on public.user_quest_objectives from anon, authenticated;
revoke insert, update, delete on public.user_quests from anon, authenticated;
revoke insert, update, delete on public.user_skills from anon, authenticated;
revoke insert, update, delete on public.user_titles from anon, authenticated;
revoke insert, update, delete on public.wealth_logs from anon, authenticated;
revoke insert, update, delete on public.workout_timer_sessions from anon, authenticated;
