#!/bin/bash
sudo -u postgres psql -c "CREATE DATABASE local_pg_db;"
# Password comes from the environment (see .env) - never hardcode credentials here.
: "${PG_PASSWORD:?PG_PASSWORD is not set - export it or 'set -a; . ./.env; set +a' first}"
sudo -u postgres psql -c "CREATE USER local_pg_user WITH PASSWORD '$PG_PASSWORD';"
sudo -u postgres psql -c "ALTER ROLE local_pg_user SET client_encoding TO 'utf8';"
sudo -u postgres psql -c "ALTER ROLE local_pg_user SET default_transaction_isolation TO 'read committed';"
sudo -u postgres psql -c "ALTER ROLE local_pg_user SET timezone TO 'UTC';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE local_pg_db TO local_pg_user;"
