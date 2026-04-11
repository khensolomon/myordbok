FROM python:3.12-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV HOME=/tmp

# Set work directory
WORKDIR /code

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    default-libmysqlclient-dev \
    pkg-config \
    && pip install --no-cache-dir mysqlclient \
    && apt-get purge -y --auto-remove gcc python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt gunicorn

# Copy the entire project into the container
# This includes the frontend build artifacts (provided .dockerignore allows them)
COPY . .

# ---> BUILD STEP: Static Collection <---
# This ensures the Vite manifest is gathered into the image layers.
# We use dummy variables to bypass Django settings checks during build.
# RUN SECRET_KEY="dummy-key-for-build" DATABASE_URL="sqlite:///" python manage.py collectstatic --noinput

# Setup the entrypoint script
# We ensure the script has execution permissions
RUN chmod +x /code/scripts/entrypoint.sh

# Create tmp directory for Gunicorn heartbeat
RUN mkdir -p /tmp/gunicorn && chmod 777 /tmp/gunicorn

# Use ENTRYPOINT to run our startup script.
# This replaces the CMD and ensures initialization logic runs in production.
ENTRYPOINT ["/code/scripts/entrypoint.sh"]