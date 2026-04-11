from django.core.management.base import BaseCommand
from django.core.management import call_command
from django.db import connection

class Command(BaseCommand):
    help = "Initializes the project: migrations, NLTK data, and custom setup."

    def handle(self, *args, **options):
        tables = connection.introspection.table_names()
        
        if 'auth_user' not in tables:
            self.stdout.write("New database detected. Starting initialization...")
            
            # Run migrations
            call_command('migrate', interactive=False)
            
            # Download NLTK data
            self.stdout.write("Downloading NLTK wordnet...")
            call_command('download_wordnet', interactive=False)
            
            # Run your other custom setup
            # call_command('custom_setup')
            
            self.stdout.write(self.style.SUCCESS("Initialization complete."))
        else:
            self.stdout.write("Existing database found. Skipping initialization.")
        
        call_command('download_wordnet')
