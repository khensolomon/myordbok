"""
version: 2025.09.16.15

Recent Updates:
- Implemented context-aware search logging to fix a bug where translated
  words were logged with the wrong source language context.
- The engine now correctly logs the user's original intended search term
  (e.g., 'avbilde') even when navigating to an alternative translation
  (e.g., 'Depict'), ensuring accurate analytics.
"""
from django.db.models import F
from ...utils import is_myanmar
from ...models.log import LogSearch
from .ome import OmeData
from .oem import OemData
from .ord import OrdData
from config.data import DICTIONARIES


class DictionarySearch:
    """
    Main search engine controller.
    This class now constructs a new, unified `result` object that provides
    rich context about the query processing, including sentence and translation info.
    """
    def __init__(self, raw_query, app_name="Dictionary"):
        self.raw_query = raw_query
        self.app_name = app_name
        # --- Contextual State ---
        self.is_sentence = False
        self.sentence_list = []
        self.target_word = ""
        self.translation_info = None
        self.solId = 'en' # Default language
        self.log = []     # Initialize log as an instance attribute

    def execute(self, solId=None):
        """
        Main method to execute the search sequence. It now builds a rich
        contextual result object instead of separate meta/query blocks.
        """
        # --- Data returned from handlers ---
        status = 0
        data = []
        messages = []
        todo = []

        # 1. Validate and parse the initial query
        if not self._validate_and_prepare_query():
            messages.append("Query cannot be empty.")
            return self._get_response(status, data, messages, self.log, todo)

        # Set the source language, defaulting to 'en'
        self.solId = solId if solId else 'en'
        self.log.append(f"Engine: Source language set to '{self.solId}'.")

        # 2. Handle Myanmar script branch
        if is_myanmar(self.target_word):
            self.solId = 'my' # Override lang for Myanmar script
            ome_handler = OmeData(self.target_word)
            status, data, messages, log_ome, todo = ome_handler.search()
            self.log.extend(log_ome)
            self._log_search(status, self.target_word)
            return self._get_response(status, data, messages, self.log, todo)

        # --- REFACTORED ORD & TRANSLATION LOGIC ---
        all_langs = [lang for group in DICTIONARIES for lang in group['lang']]
        valid_langs = [lang['id'] for lang in all_langs]
        processed_word = self.target_word
        display_context_word = self.target_word
        word_for_logging = self.target_word # Default to the direct target

        if self.solId in valid_langs and self.solId != 'en':
            word_to_translate = self.target_word
            
            if self.is_sentence and self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list]:
                display_context_word = self.sentence_list[0] if self.sentence_list else self.target_word
                word_to_translate = display_context_word
                word_for_logging = display_context_word # Log the original word, not the translation
                self.log.append(f"Engine: Context preservation triggered for alternative '{self.target_word}'. Rebuilding from '{word_to_translate}'.")

            self.log.append(f"Engine: Initializing ORD lookup for '{word_to_translate}'.")
            ord_handler = OrdData(word_to_translate, self.solId)
            translations, log_ord = ord_handler.get_translations()
            self.log.extend(log_ord)

            if translations:
                if word_to_translate != self.target_word:
                    processed_word = self.target_word
                else:
                    processed_word = translations[0]
                
                self.translation_info = { "primary": processed_word, "alternatives": [t for t in translations if t.lower() != processed_word.lower()] }
                self.log.append(f"Engine: Word for OEM is '{processed_word}'. Alternatives found: {self.translation_info['alternatives']}")
            else:
                self.log.append(f"Engine: ORD lookup for '{word_to_translate}' in '{self.solId}' found no match. Falling back to OEM.")
                self.solId = 'en' # Reset language to English
                self.log.append(f"Engine: Source language has been reset to '{self.solId}'.")


        # 4. Proceed to English (OEM) search
        oem_handler = OemData(processed_word)
        status, data, messages, log_oem, todo = oem_handler.search()
        self.log.extend(log_oem)
        
        # 5. Log the search using the context-aware word
        self._log_search(status, word_for_logging)
        
        # 6. Final data adjustments for translated words
        if self.translation_info and data:
            data[0]['word'] = f"{display_context_word} ({self.translation_info['primary']})"
        
        return self._get_response(status, data, messages, self.log, todo)

    def _log_search(self, status, word_to_log):
        """
        Creates or updates a LogSearch entry for the given word.
        """
        obj, created = LogSearch.objects.get_or_create(
            word=word_to_log,
            lang=self.solId,
            defaults={'count': 1, 'status': status}
        )

        if not created:
            obj.count = F('count') + 1
            obj.status = status
            obj.save(update_fields=['count', 'status', 'updated_at'])
        
        self.log.append(f"Engine: Logged search for '{word_to_log}' in lang '{self.solId}' with status {status}.")


    def _validate_and_prepare_query(self):
        """
        Cleans, validates, and deconstructs the raw query string into its parts.
        Correctly identifies multi-word queries as sentences.
        """
        if not self.raw_query or not self.raw_query.strip():
            return False

        query_str = self.raw_query.strip()

        # Check for explicit sentence targeting with '~'
        if '~' in query_str:
            self.is_sentence = True
            sentence_part, target_part = query_str.split('~', 1)
            self.sentence_list = [word.strip() for word in sentence_part.strip().split(' ') if word.strip()]
            self.target_word = target_part.strip(".,;:?!'\"- ")
        else:
            # Handle implicit sentences (multiple words) and single words
            words = [word.strip() for word in query_str.split(' ') if word.strip()]
            
            if len(words) > 1:
                self.is_sentence = True
                self.sentence_list = words
                self.target_word = words[0].strip(".,;:?!'\"- ")
            elif len(words) == 1:
                self.is_sentence = False
                self.sentence_list = []
                self.target_word = words[0].strip(".,;:?!'\"- ")
            else:
                return False
        
        return True

    def _generate_metadata(self, status, data):
        """
        Generates dynamic metadata for HTML headers based on search results.
        """
        title = f"Search for '{self.target_word}' | {self.app_name}"
        description = f"Search our comprehensive dictionary for millions of words and translations."
        keywords = f"{self.target_word}, dictionary, search, definition"

        # Handle successful search
        if status == 1 and data:
            first_entry = data[0]
            word = first_entry.get('word', self.target_word)
            
            # If it was a translation, make a more specific title
            if self.translation_info:
                all_langs = [lang for group in DICTIONARIES for lang in group['lang']]
                # Determine the correct language name for the metadata title
                original_lang_id = self.solId
                if self.translation_info:
                    # Find the original source language ID before any potential fallback
                    for group in DICTIONARIES:
                        for lang in group['lang']:
                            if self.target_word.lower() not in [w.lower() for w in self.sentence_list] and self.sentence_list:
                                if self.sentence_list[0].lower() not in [w.lower() for w in self.sentence_list]:
                                     original_lang_id = lang['id']
                
                lang_name = next((item['name'] for item in all_langs if item["id"] == original_lang_id), original_lang_id)
                display_word = self.sentence_list[0] if self.is_sentence and self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list] else self.target_word
                title = f"{lang_name} to English translation for '{display_word}' | {self.app_name}"
                description = f"Translate '{display_word}' from {lang_name} to English. Get definitions for '{self.translation_info['primary']}' and explore alternative translations."
                keywords = f"{display_word}, {self.translation_info['primary']}, {lang_name} to English, translation, dictionary"
            else:
                title = f"Definition of {word} | {self.app_name}"
                # Try to get the first sense for a rich description
                try:
                    first_meaning_group = next(iter(first_entry['clue']['meaning'].values()))
                    first_sense_text = first_meaning_group[0]['sense'][0]['mean'][0]
                    description = f"Find the definition, synonyms, and pronunciation for {word}. The primary meaning is: '{first_sense_text}'."
                except (IndexError, KeyError, StopIteration):
                    description = f"Find the definition, synonyms, and pronunciation for {word} in our dictionary."

                # Build rich keywords
                kw_set = {word, 'definition', 'meaning', 'pronunciation'}
                for pos, meanings in first_entry['clue']['meaning'].items():
                    kw_set.add(pos)
                    for meaning in meanings:
                        if meaning['type'] == 'thesaurus':
                            kw_set.update(meaning['exam']['value'][:5]) # Add up to 5 synonyms
                keywords = ", ".join(kw_set)

        return {"title": title, "description": description, "keywords": keywords}

    def _get_response(self, status, data, messages, log, todo):
        """
        Constructs the final, unified JSON response object.
        """
        # Determine the original word for the query context.
        # This logic ensures the `target_word` in the response reflects the initial search intent.
        query_target = self.target_word
        if self.is_sentence:
            # If it's a sentence and context was rebuilt, the target is the first word.
            if self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list]:
                query_target = self.sentence_list[0] if self.sentence_list else self.target_word
            else:
                query_target = self.target_word

        # Build the query context object
        query_context = {
            "is_sentence": self.is_sentence,
            "target_word": query_target,
            "list": self.sentence_list
        }

        # --- UPDATED: Build the enriched translation context object ---
        alternatives_list = []
        if self.translation_info:
            raw_alternatives = self.translation_info.get('alternatives', [])
            # Use the original full query context for the links
            query_context_str = " ".join(self.sentence_list) if self.is_sentence else query_target
            
            for alt_word in raw_alternatives:
                alternatives_list.append({
                    "word": alt_word,
                    "query": f"{query_context_str}~{alt_word}"
                })

        translation_context = {
            "is_active": self.translation_info is not None,
            "primary_word": self.translation_info['primary'] if self.translation_info else "",
            "alternatives": alternatives_list
        }
        
        # --- Generate and include the metadata block ---
        metadata = self._generate_metadata(status, data)

        # Build the final result object
        result_obj = {
            "status": status,
            "lang": self.solId,
            "meta": metadata,
            "log": log,
            "todo": todo,
            "messages": messages,
            "query": query_context,
            "translation": translation_context
        }

        return {
            "result": result_obj,
            "data": data
        }

