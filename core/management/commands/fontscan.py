"""
Django management command to scan font directories and sync with the database.

This command inspects the font directories specified by the FONT_DIR setting
(e.g., 'primary', 'secondary', 'external') for TTF files. For each file found,
it parses the metadata and creates or updates a corresponding record in the
'ListFont' database model.

It also cleans up the database by removing records for fonts that no longer
exist on the file system, ensuring the database remains in sync.

This is essential for populating the font metadata cache that the main
application uses, improving performance by avoiding on-the-fly file parsing.

Usage:
------
To scan all configured font type directories:
$ python manage.py fontscan

To scan only a specific directory (e.g., 'secondary'):
$ python manage.py fontscan secondary

This command can be run manually after adding new fonts or automated as a
periodic task (e.g., using a cron job) to keep the font list up-to-date.
"""
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone
from ...assist.fonts import data as font_db 
from ...models import FontType

class Command(BaseCommand):
    help = 'Scans the font directories and updates the database with metadata.'

    def add_arguments(self, parser):
        # Optional argument for a specific font type
        parser.add_argument(
            'font_type',
            nargs='?', # makes the argument optional
            type=str,
            help='Specify a font type to scan (e.g., primary, secondary, external). Scans all if omitted.'
        )

    def handle(self, *args, **options):
        font_type_arg = options['font_type']
        
        start_time = timezone.now()
        self.stdout.write(self.style.SUCCESS(f"Starting font scan at {start_time.strftime('%Y-%m-%d %H:%M:%S')}..."))

        if font_type_arg:
            # A specific type was provided
            if font_type_arg not in [ft.label for ft in FontType]:
                raise CommandError(f"'{font_type_arg}' is not a valid font type. Use one of: primary, secondary, external.")
            
            self.stdout.write(f"Scanning '{font_type_arg}' directory...")
            result = font_db.scan_and_sync_database(font_type_arg)
            self.stdout.write(f"-> {result}")
        else:
            # No type was specified, scan all
            self.stdout.write("Scanning all font directories...")
            for font_type in [ft.label for ft in FontType]:
                self.stdout.write(f"-> Scanning '{font_type}'...")
                result = font_db.scan_and_sync_database(font_type)
                self.stdout.write(f"   {result}")

        end_time = timezone.now()
        duration = end_time - start_time
        self.stdout.write(self.style.SUCCESS(f"Font scan finished in {duration.total_seconds():.2f} seconds."))

