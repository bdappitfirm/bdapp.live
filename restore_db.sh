#!/bin/bash
set -e

# Stop services to avoid DB locks
systemctl stop gunicorn
systemctl stop gunicorn.socket

# Terminate existing connections to the database
sudo -u postgres psql -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = 'local_pg_db' AND pid <> pg_backend_pid();"

# Drop and recreate the database
sudo -u postgres dropdb local_pg_db --if-exists
sudo -u postgres createdb local_pg_db
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE local_pg_db TO local_pg_user;"
# In newer PostgreSQL, we also need to grant on public schema
sudo -u postgres psql -d local_pg_db -c "GRANT ALL ON SCHEMA public TO local_pg_user;"

# Move dump to /tmp for postgres access
mv /root/local_db_final.sql /tmp/local_db_final.sql
chmod 644 /tmp/local_db_final.sql

# Restore the dump using psql
sudo -u postgres psql -d local_pg_db -f /tmp/local_db_final.sql

# Grant permissions to the user
sudo -u postgres psql -d local_pg_db -c "GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO local_pg_user;"
sudo -u postgres psql -d local_pg_db -c "GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO local_pg_user;"
sudo -u postgres psql -d local_pg_db -c "GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA public TO local_pg_user;"
sudo -u postgres psql -d local_pg_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO local_pg_user;"
sudo -u postgres psql -d local_pg_db -c "ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO local_pg_user;"

# Cleanup
rm /tmp/local_db_final.sql

# Start services back up
systemctl start gunicorn.socket
systemctl start gunicorn
systemctl restart nginx

echo "Database restore completed successfully."
