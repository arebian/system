create index if not exists skill_attempts_skill_id_idx on public.skill_attempts(skill_id);
create index if not exists skill_attempts_proof_record_id_idx on public.skill_attempts(proof_record_id) where proof_record_id is not null;
drop policy if exists skill_attempts_select_own on public.skill_attempts;
create policy skill_attempts_select_own on public.skill_attempts for select to authenticated using ((select auth.uid()) = user_id);
