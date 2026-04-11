#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Entrypoint Script ---"

# 1. Wait for MySQL to become ready (Swarm VIP fix)
echo "Waiting for database to accept queries..."
attempt=1
max_attempts=45

# We use Django's own command to verify the DB is actually accepting connections,
# bypassing the Docker Swarm VIP port illusion.
while ! python manage.py showmigrations > /dev/null 2>&1; do
    if [ $attempt -ge $max_attempts ]; then
        echo "Database did not become ready in time. Exiting."
        exit 1
    fi
    echo "Database unavailable or initializing - sleeping for 2 seconds (Attempt $attempt/$max_attempts)..."
    sleep 2
    attempt=$((attempt+1))
done

echo "Database is fully ready and accepting queries!"

# 2. Standard Static Collection
echo "Collecting static files..."
python manage.py collectstatic --noinput --no-default-ignore

# 3. Apply Migrations BEFORE Initialization
echo "Applying database migrations..."
python manage.py migrate --noinput

# 4. Custom Initialization Command
echo "Running custom project initialization..."
python manage.py initialize_project

# 5. Handle Command Overrides
if [ "$#" -gt 0 ]; then
    echo "Executing override command: $@"
    exec "$@"
fi

# 6. Default: Start Gunicorn
echo "No command provided, starting Gunicorn on port ${APP_PORT}..."
exec gunicorn config.wsgi:application \
     --bind 0.0.0.0:${APP_PORT} \
     --worker-tmp-dir /tmp/gunicorn \
     --workers 3