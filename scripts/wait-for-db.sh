#!/bin/sh
set -e

echo "=== Database Environment Variables ==="
echo "DATABASE_URL=${DATABASE_URL:-<not set>}"
echo "DB_URL=${DB_URL:-<not set>}"
echo "POSTGRES_URL=${POSTGRES_URL:-<not set>}"
echo "DATABASE_HOST=${DATABASE_HOST:-<not set>}"
echo "DB_HOST=${DB_HOST:-<not set>}"
echo "POSTGRES_HOST=${POSTGRES_HOST:-<not set>}"
echo "PGHOST=${PGHOST:-<not set>}"
echo "DATABASE_PORT=${DATABASE_PORT:-<not set>}"
echo "REDIS_URL=${REDIS_URL:-<not set>}"
echo "======================================="

DB_URL="${DATABASE_URL:-${DB_URL:-${POSTGRES_URL:-}}}"
DB_HOST="${DATABASE_HOST:-${DB_HOST:-${POSTGRES_HOST:-${PGHOST:-}}}}"
DB_PORT="${DATABASE_PORT:-${DB_PORT:-${POSTGRES_PORT:-${PGPORT:-5432}}}}"

if [ -n "$DB_URL" ]; then
  echo "Waiting for database from DATABASE_URL..."
  HOST=$(echo "$DB_URL" | sed -E 's/\/\/([^:@]+)(:[^@]*)?@([^:\/]+).*/\3/')
  PORT=$(echo "$DB_URL" | sed -E 's/\/\/[^\/]+\/([^:]+).*/\1/' | sed 's/\?.*//')
  [ -z "$PORT" ] && PORT="5432"
elif [ -n "$DB_HOST" ]; then
  echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
  HOST="$DB_HOST"
  PORT="$DB_PORT"
else
  echo "No DATABASE_URL or DATABASE_HOST detected — skipping wait, letting NestJS connect directly."
  exit 0
fi

MAX_RETRIES="${DATABASE_WAIT_RETRIES:-60}"
DELAY_MS="${DATABASE_WAIT_DELAY:-2000}"

for i in $(seq 1 "$MAX_RETRIES"); do
  if nc -z "$HOST" "$PORT" 2>/dev/null; then
    echo "PostgreSQL is ready after ${i} attempt(s)!"
    exit 0
  fi
  echo "PostgreSQL not ready yet (attempt ${i}/${MAX_RETRIES}), retrying in ${DELAY_MS}ms..."
  sleep "$(echo "$DELAY_MS / 1000" | bc)"
done

echo "PostgreSQL did not become ready in time — continuing anyway. NestJS will handle reconnection."
exit 0
