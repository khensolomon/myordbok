import sys
from django.core.management.base import BaseCommand
from django.db import connections
from django.db.utils import OperationalError
from django.core.cache import cache

class Command(BaseCommand):
    def handle(self, *args, **options):
        try:
            # 1. Check Cache (Redis/Memcached)
            # If your app relies on cache for sessions, this is critical
            cache.set('healthcheck_test', 1, timeout=1)
            if not cache.get('healthcheck_test'):
                raise Exception("Cache not responding")
            
            # 2. Check ALL database connections
            # (In case you have multiple DBs like 'default' and 'read-only')
            # for name in connections:
            #     cursor = connections[name].cursor()
            #     cursor.execute("SELECT 1;")

            # 3. Check Disk Write Permissions
            # Ensure your media/storage folders haven't gone read-only
            # with open('/tmp/health_test.txt', 'w') as f:
            #     f.write('check')

            self.stdout.write("OK")
            sys.exit(0)

        except (OperationalError, Exception) as e:
            self.stderr.write(f"Healthcheck failed: {str(e)}")
            sys.exit(1)