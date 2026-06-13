# syntax=docker/dockerfile:1.6

# =============================================================================
# Stage 1: Builder
# -----------------------------------------------------------------------------
# Compiles mysqlclient and installs all Python dependencies into an isolated
# prefix. This stage carries the full build toolchain (gcc, dev headers) but
# is discarded — only the finished /install directory is copied to the final
# image.
# =============================================================================
FROM python:3.12-slim AS builder

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Build-time system dependencies. default-libmysqlclient-dev provides the
# headers mysqlclient needs to compile against; on Debian this points to
# MariaDB's client library by default.
RUN apt-get update && apt-get install -y --no-install-recommends \
        gcc \
        default-libmysqlclient-dev \
        pkg-config \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies into /install. Using --prefix lets us copy the
# whole tree to the final stage in one COPY without dragging pip's cache,
# build artifacts, or apt state along with it.
COPY requirements.txt .
RUN pip install --prefix=/install -r requirements.txt gunicorn


# =============================================================================
# Stage 2: Final runtime image
# -----------------------------------------------------------------------------
# Starts fresh from python:3.12-slim. No compilers, no -dev headers — only
# the runtime MariaDB client library and the installed Python packages from
# the builder stage.
# =============================================================================
FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    HOME=/tmp

# Runtime-only system dependencies. libmariadb3 is the shared library
# mysqlclient was linked against in the builder stage; it must be present
# at runtime too, but the much larger -dev package is not needed here.
RUN apt-get update && apt-get install -y --no-install-recommends \
        libmariadb3 \
    && rm -rf /var/lib/apt/lists/*

# Pull the installed Python packages over from the builder stage.
COPY --from=builder /install /usr/local

WORKDIR /code

# Copy the project. Make sure .dockerignore excludes .git, __pycache__,
# node_modules, .venv, .env*, tests/, etc. — everything in the build
# context lands in the image.
COPY . .

# Entrypoint setup + Gunicorn heartbeat dir, combined into one layer.
RUN chmod +x /code/scripts/entrypoint.sh \
    && mkdir -p /tmp/gunicorn \
    && chmod 777 /tmp/gunicorn

ENTRYPOINT ["/code/scripts/entrypoint.sh"]