#!/bin/sh
set -e

# Inngest exits 1 with "no schema" unless the schema in its search_path already exists
psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<SQL
CREATE SCHEMA IF NOT EXISTS "${INNGEST_SCHEMA:-inngest}";
SQL
