import nltk
from django.core.management.base import BaseCommand, CommandError

class Command(BaseCommand):
    """
    A Django management command to download the NLTK WordNet corpus.
    
    This command is idempotent, meaning it can be run safely multiple times.
    It checks if the WordNet corpus is already available and only downloads it
    if necessary.
    """
    help = 'Downloads the NLTK WordNet corpus if it is not already present.'

    def handle(self, *args, **options):
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
