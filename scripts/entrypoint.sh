#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Entrypoint Script ---"

# 1. Standard Static Collection
echo "Collecting static files..."
# python manage.py collectstatic --noinput
# python manage.py collectstatic --clear --noinput
# python manage.py collectstatic --clear --noinput --no-default-ignore
python manage.py collectstatic --noinput --no-default-ignore


# . Cleanup "static" folder except for .vite ---
# echo "Cleaning up static directory (preserving .vite)..."
# find /code/static -mindepth 1 ! -path "/code/static/.vite*" -delete
# ------------------------------------------------

# 2. Wait for MySQL to become ready
echo "Waiting for database at ${DB_HOST:-db}:${DB_PORT:-3306}..."
while ! python -c "import socket, os; s = socket.socket(socket.AF_INET, socket.SOCK_STREAM); s.settimeout(1); s.connect((os.environ.get('DB_HOST', 'db'), int(os.environ.get('DB_PORT', 3306))))" 2>/dev/null; do
    echo "Database unavailable - sleeping for 2 seconds..."
    sleep 2
done
echo "Database is ready!"

# 3. Apply Migrations BEFORE Initialization
# Moving this here fixes the race condition in your GitHub Action deploy sequence
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