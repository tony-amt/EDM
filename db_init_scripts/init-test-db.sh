#!/bin/bash
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    SELECT 'CREATE DATABASE amt_mail_test'
    WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'amt_mail_test')\gexec
EOSQL

echo "Database 'amt_mail_test' checked/created." 