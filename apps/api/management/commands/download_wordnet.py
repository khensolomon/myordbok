import os

import nltk
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings

class Command(BaseCommand):
    """
    A Django management command to download the NLTK WordNet corpus.
    
    This command is idempotent, meaning it can be run safely multiple times.
    It checks if the WordNet corpus is already available and only downloads it
    if necessary.

    Usage: 
        python manage.py download_wordnet
        python -c "import nltk; nltk.download('wordnet')"
    """
    help = 'Downloads the NLTK WordNet corpus if it is not already present.'

    def handle(self, *args, **options):
        # settings.STORAGE_DIR;
        # download_dir = os.path.join(settings.STORAGE_DIR, 'myordbok','nltk_data')
        # download_dir = '/usr/local/nltk_data'
        # nltk.data.path.append(download_dir)
        # download_dir = os.environ.get('NLTK_DATA')
        # download_dir = os.environ.get('NLTK_DATA')
        # nltk.download('wordnet', download_dir=download_dir)

        try:
            self.stdout.write("Checking for NLTK's WordNet corpus...")
            # nltk.data.find() will raise a LookupError if the resource is not found.
            nltk.data.find('corpora/wordnet.zip')
            self.stdout.write(self.style.SUCCESS('WordNet corpus is already downloaded.'))
        except LookupError:
            self.stdout.write(self.style.WARNING('WordNet corpus not found. Starting download...'))
            try:
                nltk.download('wordnet')
                self.stdout.write(self.style.SUCCESS('Successfully downloaded WordNet corpus.'))
            except Exception as e:
                raise CommandError(f'An error occurred during download: {e}')
        except Exception as e:
            raise CommandError(f"An unexpected error occurred: {e}")
