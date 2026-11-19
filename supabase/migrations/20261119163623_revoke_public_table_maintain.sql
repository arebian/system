-- MAINTAIN is a PostgreSQL 17+ table privilege (VACUUM/ANALYZE/REINDEX).
-- It is not required by API roles; remove it from existing and future postgres-owned tables.
revoke maintain on all tables in schema public from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke maintain on tables from anon, authenticated;
