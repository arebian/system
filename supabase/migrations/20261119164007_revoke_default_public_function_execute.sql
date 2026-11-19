-- PostgreSQL's global default for new functions grants EXECUTE to PUBLIC.
-- A schema-level revoke cannot override that global grant, so remove it globally
-- for functions created by the postgres migration role.
alter default privileges for role postgres
  revoke execute on functions from public;
