#!/bin/sh

# Exit immediately if a command exits with a non-zero status.
set -e

echo "--- Starting Entrypoint Script ---"

# 1. Standard Static Collection
# echo "Collecting static files..."
# python manage.py collectstatic --noinput
python manage.py collectstatic --clear --noinput
# python manage.py collectstatic --clear --noinput --no-default-ignore
# python manage.py collectstatic --noinput --no-default-ignore


# 2. Cleanup "static" folder except for .vite ---
# echo "Cleaning up static directory (preserving .vite)..."
find /code/static -mindepth 1 ! -path "/code/static/.vite*" -delete

# 3. Custom Initialization Command
echo "Running custom project initialization..."
python manage.py initialize_project

# 4. Handle Command Overrides
# This is the fix! If a command is passed to 'docker run' (like migrate),
# we execute that command instead of starting Gunicorn.
if [ "$#" -gt 0 ]; then
    echo "Executing override command: $@"
    exec "$@"
fi

# 5.a Default: Start Gunicorn
echo "No command provided, starting Gunicorn on port ${APP_PORT}..."
exec gunicorn config.wsgi:application \
     --bind 0.0.0.0:${APP_PORT} \
     --worker-tmp-dir /tmp/gunicorn \
     --workers 3

# 5.b Composed Version (if you want to keep it separate)
# echo "Starting Composed version Gunicorn..."
# exec gunicorn config.wsgi:application \
#         --bind 0.0.0.0:${APP_PORT} \
#         --worker-tmp-dir /tmp/gunicorn