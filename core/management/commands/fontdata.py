"""
Django management command to backup and restore font statistics.

This command provides tools to manage the data within the 'Fonts' model,
specifically for disaster recovery or migration purposes. It allows an
administrator to export the view, download, and status counts for all fonts
into a JSON file, and to restore this data from a backup file.

Usage:
------
To back up all font data to a file (default: cache/font_stats_backup.json):
$ python manage.py fontdata backup

To specify a different backup file:
$ python manage.py fontdata backup --output my_backup.json

To restore font data from a backup file:
$ python manage.py fontdata restore cache/font_stats_backup.json
"""
import json
from django.core.management.base import BaseCommand, CommandError
from django.core import serializers
from django.db import transaction
from ...models import ListFont

class Command(BaseCommand):
    help = 'Backs up or restores font statistics (views, downloads, status).'

    def add_arguments(self, parser):
        # Create subparsers for the 'backup' and 'restore' commands
        subparsers = parser.add_subparsers(dest='command', required=True)

        # Backup command
        backup_parser = subparsers.add_parser('backup', help='Export font data to a JSON file.')
        backup_parser.add_argument(
            '--output',
            type=str,
            default='cache/font_stats_backup.json',
            help='The name of the file to save the backup to.'
        )

        # Restore command
        restore_parser = subparsers.add_parser('restore', help='Import font data from a JSON file.')
        restore_parser.add_argument(
            'input_file',
            type=str,
            help='The JSON backup file to restore from.'
        )

    @transaction.atomic
    def handle(self, *args, **options):
        if options['command'] == 'backup':
            self.handle_backup(options)
        elif options['command'] == 'restore':
            self.handle_restore(options)

    def handle_backup(self, options):
        output_file = options['output']
        self.stdout.write(f"Backing up font data to '{output_file}'...")

        fonts_qs = ListFont.objects.all()
        data = serializers.serialize('json', fonts_qs, indent=2)

        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(data)
        
        self.stdout.write(self.style.SUCCESS(f"Successfully backed up {fonts_qs.count()} font records."))

    def handle_restore(self, options):
        input_file = options['input_file']
        self.stdout.write(f"Restoring font data from '{input_file}'...")

        try:
            with open(input_file, 'r') as f:
                deserialized_objects = serializers.deserialize('json', f)
                
                count = 0
                for deserialized_obj in deserialized_objects:
                    font_data = deserialized_obj.object
                    ListFont.objects.update_or_create(
                        file=font_data.file,
                        defaults={
                            'view': font_data.view,
                            'download': font_data.download,
                            'status': font_data.status
                        }
                    )
                    count += 1
            
            self.stdout.write(self.style.SUCCESS(f"Successfully restored data for {count} font records."))

        except FileNotFoundError:
            raise CommandError(f"Backup file '{input_file}' not found.")
        except Exception as e:
            raise CommandError(f"An error occurred during restore: {e}")
