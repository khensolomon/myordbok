FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1

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

# Copy project
COPY . .

# Create tmp directory for Gunicorn heartbeat (prevents worker timeouts in some environments)
RUN mkdir -p /tmp/gunicorn && chmod 777 /tmp/gunicorn

# Use Shell form to ensure $APP_PORT is evaluated
CMD gunicorn config.wsgi:application --bind 0.0.0.0:$APP_PORT --worker-tmp-dir /tmp/gunicorn
# CMD gunicorn --worker-tmp-dir /dev/shm --bind 0.0.0.0:${APP_PORT} config.wsgi:application
# CMD gunicorn --worker-tmp-dir /dev/shm --pid /tmp/gunicorn.pid --bind 0.0.0.0:${APP_PORT} config.wsgi:application

#