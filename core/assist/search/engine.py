"""
version: 2025.09.18.6

Recent Updates:
- Fixed a critical bug where logs would incorrectly report a "Cache MISS"
  on a successful cache hit.
- Refactored the caching mechanism to store only the core data, not the
  entire response object.
- The engine now constructs a fresh `result` block on a cache hit, ensuring
  the logs are always accurate for every request.
"""
from django.db.models import F
from django.core.cache import cache
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
        # --- Internal State ---
        status = 0
        data = []
        messages = []
        todo = []
        result_count = 0
        state = "NOT_FOUND"

        # 1. Validate and parse the initial query
        if not self._validate_and_prepare_query():
            messages.append("Query cannot be empty.")
            state = "INVALID_QUERY"
            self._log_search(0, self.target_word or "empty_query")
            return self._get_response(status, data, messages, self.log, todo, state)

        self.solId = solId if solId else 'en'
        self.log.append(f"Engine: Source language set to '{self.solId}'.")
        
        # --- REFACTORED CACHE LOGIC ---
        cache_key = f"search:{self.solId}:{self.target_word.lower()}"
        cached_data_tuple = cache.get(cache_key)
        
        db_num = self._get_cache_db_num()
        cache_location = f"Redis DB #{db_num}" if db_num is not None else "the configured cache"

        if cached_data_tuple:
            self.log.append(f"Engine: Cache HIT for key '{cache_key}' in {cache_location}.")
            # Unpack the core data from the cache
            status, data, messages, todo, result_count = cached_data_tuple
            state = "SUCCESS" if status == 1 else "NOT_FOUND"
            # We still log the search even on a cache hit for analytics
            self._log_search(result_count, self.target_word)
            return self._get_response(status, data, messages, self.log, todo, state)

        self.log.append(f"Engine: Cache MISS for key '{cache_key}' in {cache_location}.")

        # 2. Handle Myanmar script branch
        if is_myanmar(self.target_word):
            self.solId = 'my'
            ome_handler = OmeData(self.target_word)
            status, data, messages, log_ome, todo, result_count = ome_handler.search()
            self.log.extend(log_ome)
            self._log_search(result_count, self.target_word)
            state = "SUCCESS" if status == 1 else "NOT_FOUND"
            response = self._get_response(status, data, messages, self.log, todo, state)
            # Cache the core data tuple
            cache.set(cache_key, (status, data, messages, todo, result_count), timeout=3600)
            return response

        # 3. Handle ORD & OEM flow
        processed_word = self.target_word
        display_context_word = self.target_word
        all_langs = [lang for group in DICTIONARIES for lang in group['lang']]
        valid_langs = [lang['id'] for lang in all_langs]

        if self.solId in valid_langs and self.solId != 'en':
            word_to_translate = self.target_word
            if self.is_sentence and self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list]:
                display_context_word = self.sentence_list[0] if self.sentence_list else self.target_word
                word_to_translate = display_context_word
                self.log.append(f"Engine: Context preservation triggered for alternative '{self.target_word}'. Rebuilding from '{word_to_translate}'.")

            ord_handler = OrdData(word_to_translate, self.solId)
            translations, log_ord = ord_handler.get_translations()
            self.log.extend(log_ord)

            if translations:
                processed_word = translations[0] if word_to_translate == self.target_word else self.target_word
                self.translation_info = { "primary": processed_word, "alternatives": [t for t in translations if t.lower() != processed_word.lower()] }
            else:
                self.log.append(f"Engine: ORD lookup failed for '{word_to_translate}'. Falling back to OEM.")
                self.solId = 'en'
        
        oem_handler = OemData(processed_word)
        status, data, messages_oem, log_oem, todo, result_count = oem_handler.search()
        messages.extend(messages_oem)
        self.log.extend(log_oem)
        
        self._log_search(result_count, self.target_word)
        
        if self.translation_info and data:
            data[0]['word'] = f"{display_context_word} ({self.translation_info['primary']})"
        
        state = "SUCCESS" if status == 1 else "NOT_FOUND"
        
        response = self._get_response(status, data, messages, self.log, todo, state)
        if status == 1:
            # Cache the core data tuple
            cache.set(cache_key, (status, data, messages, todo, result_count), timeout=3600)
            self.log.append(f"Engine: Stored successful result in cache for key '{cache_key}' in {cache_location}.")
            
        return response

    def _log_search(self, result_count, word_to_log):
        obj, created = LogSearch.objects.get_or_create(
            word=word_to_log,
            lang=self.solId,
            defaults={'count': 1, 'status': result_count}
        )

        if not created:
            obj.count = F('count') + 1
            obj.status = result_count
            obj.save(update_fields=['count', 'status', 'updated_at'])
        
        self.log.append(f"Engine: Logged search for '{word_to_log}' in lang '{self.solId}' with result count {result_count}.")


    def _validate_and_prepare_query(self):
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

    def _generate_metadata(self, status, data, state):
        title = f"Search for '{self.target_word}' | {self.app_name}"
        if state == "INVALID_QUERY":
            title = f"Invalid Search | {self.app_name}"

        description = f"Search our comprehensive dictionary for millions of words and translations."
        keywords = f"{self.target_word}, dictionary, search, definition"

        # Handle successful search
        if status == 1 and data:
            first_entry = data[0]
            word = first_entry.get('word', self.target_word)
            
            # If it was a translation, make a more specific title
            if self.translation_info:
                all_langs = [lang for group in DICTIONARIES for lang in group['lang']]
                original_lang_id = self.solId
                if self.translation_info:
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

    def _get_cache_db_num(self):
        """Helper to safely get the current Redis DB number for logging."""
        try:
            return cache.client.connection_pool.connection_kwargs.get('db', 0)
        except AttributeError:
            return None # Not a Redis cache or client not available

    def _get_response(self, status, data, messages, log, todo, state):
        # Determine the original word for the query context.
        query_target = self.target_word
        if self.is_sentence:
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

        # Build the enriched translation context object
        alternatives_list = []
        if self.translation_info:
            raw_alternatives = self.translation_info.get('alternatives', [])
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
        
        # Generate and include the metadata block
        metadata = self._generate_metadata(status, data, state)

        # Build the final result object
        result_obj = {
            "state": state,
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

