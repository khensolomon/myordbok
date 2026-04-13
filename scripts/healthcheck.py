import urllib.request
import sys
import os

"""
test: ["CMD", "python", "manage.py", "check"]
interval: 10s
timeout: 10s
retries: 2
start_period: 90s
"""

port = os.environ.get("APP_PORT", "8000")
url = f"http://localhost:{port}/health"

try:
    with urllib.request.urlopen(url, timeout=5) as response:
        if response.status == 200:
            sys.exit(0)
        else:
            sys.exit(1)
except Exception:
    sys.exit(1)