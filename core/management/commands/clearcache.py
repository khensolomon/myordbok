"""
version: 2025.09.18.3

Recent Updates:
- Simplified the command to align with the new standardized, lowercase-only
  cache keys created by the search engine.
- The command no longer needs to check for multiple casings.
"""
from django.core.management.base import BaseCommand
from django.core.cache import cache
from config.data import DICTIONARIES

class Command(BaseCommand):
    help = 'Clears the cache. Can clear the entire cache or a specific search entry.'

    def add_arguments(self, parser):
        """
        Adds optional command-line arguments to the command.
        """
        parser.add_argument(
            '--word',
            type=str,
            help='The specific word to clear from the cache.',
            default=None
        )
        parser.add_argument(
            '--lang',
            type=str,
            help='The language ID for the word to clear (e.g., en, my, no). Required if --word is used.',
            default=None
        )

    def handle(self, *args, **options):
        """
        The main logic for the command.
        """
        word = options['word']
        lang = options['lang']

        if word and lang:
            # --- Handle individual cache clearing ---
            all_langs = [l['id'] for group in DICTIONARIES for l in group['lang']]
            all_langs.append('my')

            if lang not in all_langs:
                self.stdout.write(self.style.ERROR(f"Invalid language ID '{lang}'. Please use a valid ID."))
                return

            # Build the standardized, lowercase cache key
            cache_key = f"search:{lang}:{word.lower()}"
            
            self.stdout.write(f"Attempting to clear individual cache entry: '{cache_key}'...")

            # cache.delete() returns True if the key was deleted, False otherwise.
            was_deleted = cache.delete(cache_key)
            
            if was_deleted:
                self.stdout.write(self.style.SUCCESS(f"Successfully cleared cache for '{cache_key}'."))
            else:
                self.stdout.write(self.style.WARNING(f"Cache entry for '{cache_key}' not found. It may have already expired."))

        elif word or lang:
            # Handle case where one is provided but not the other
            self.stdout.write(self.style.ERROR("Both --word and --lang must be provided to clear an individual entry."))

        else:
            # --- Handle clearing the entire cache (default behavior) ---
            self.stdout.write("Clearing the entire application cache...")
            cache.clear()
            self.stdout.write(self.style.SUCCESS('Successfully cleared the entire cache.'))

