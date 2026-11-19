-- Legacy quests have no quest_library foreign key. Preserve their one-title-per-day
-- invariant as well as the canonical (user_id, quest_id, assigned_for) key.
create unique index if not exists user_quests_legacy_title_day_uidx
  on public.user_quests (user_id, assigned_for, upper(btrim(title_snapshot)))
  where quest_id is null;
