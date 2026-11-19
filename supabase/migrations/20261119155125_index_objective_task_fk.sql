-- Cover the task-library foreign key used by objective joins and lookups.
create index if not exists user_quest_objectives_task_id_idx
  on public.user_quest_objectives (task_id);
