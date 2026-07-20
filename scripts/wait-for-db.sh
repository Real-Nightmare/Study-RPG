#!/bin/sh
set -e

DB_HOST="${DATABASE_HOST:-localhost}"
DB_PORT="${DATABASE_PORT:-5432}"
MAX_RETRIES="${DATABASE_WAIT_RETRIES:-30}"
DELAY_MS="${DATABASE_WAIT_DELAY:-2000}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."

for i in $(seq 1 "$MAX_RETRIES"); do
  if nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; then
    echo "PostgreSQL is ready after ${i} attempt(s)!"
    exit 0
  fi
  echo "PostgreSQL not ready yet (attempt ${i}/${MAX_RETRIES}), retrying in ${DELAY_MS}ms..."
  sleep "$(echo "$DELAY_MS / 1000" | bc)"
done

echo "PostgreSQL did not become ready in time"
exit 1
