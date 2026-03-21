"""
version: 2025.09.16.1

Recent Updates:
- Initial creation of the OrdData class to handle pre-processing
  of non-English words into English equivalents before OEM search.
"""
from django.apps import apps
from django.core.exceptions import AppRegistryNotReady

class OrdData:
    """
    Handles lookups in language-specific ORD tables to find English
    translations for a given source word.
    """
    def __init__(self, current_word, solId):
        """
        Initializes the ORD handler.

        Args:
            current_word (str): The word to look up.
            solId (str): The source language ID (e.g., 'no', 'ja').
        """
        self.current_word = current_word
        self.solId = solId.upper()
        self.log = []

    def get_translations(self):
        """
        Looks up the word in the appropriate ORD table and returns a list
        of English translations.

        Returns:
            list: A list of English words, or an empty list if no match is found.
        """
        model_name = f'Ord{self.solId}'
        self.log.append(f"ORD: Attempting to look up '{self.current_word}' in model '{model_name}'.")

        try:
            # Dynamically get the model based on the language ID
            OrdModel = apps.get_model('core', model_name)
        except (LookupError, AppRegistryNotReady):
            self.log.append(f"ORD: Model '{model_name}' not found or apps not ready. Skipping ORD lookup.")
            return [], self.log

        try:
            result = OrdModel.objects.filter(word__iexact=self.current_word).first()

            if result and result.sense:
                translations = [t.strip() for t in result.sense.split(';') if t.strip()]
                if translations:
                    self.log.append(f"ORD: Found {len(translations)} translation(s): {translations}.")
                    return translations, self.log
                else:
                    self.log.append("ORD: Entry found, but 'sense' field is empty.")
            else:
                self.log.append("ORD: No matching entry found.")

        except Exception as e:
            self.log.append(f"ORD: An error occurred during database lookup: {e}")

        return [], self.log
