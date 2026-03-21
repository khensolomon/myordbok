"""
version: 2025.09.28.2

Recent Updates:
- Final architectural refinement of the API response.
- Removed the now-redundant `result.meta` and `result.todo` blocks
  for a cleaner and more streamlined API contract.
"""
from django.db.models import F
from django.core.cache import cache
from ...utils import is_myanmar
from ...models.log import LogSearch
from .ome import OmeData
from .oem import OemData
from .ord import OrdData
from .constants import SearchState
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
        self.solId = 'en'
        self.log = []
        self.suggestions = []

    def execute(self, solId=None):
        """
        Main method to execute the search sequence.
        """
        # --- Internal State ---
        status, data, messages, todo, result_count = 0, [], [], [], 0
        state = SearchState.NOT_FOUND

        if not self._validate_and_prepare_query():
            messages.append("Query cannot be empty.")
            state = SearchState.INVALID_QUERY
            self._log_search(0, self.target_word or "empty_query")
            return self._get_response(status, data, messages, self.log, todo, state, self.suggestions)

        self.solId = solId if solId else 'en'
        original_solId = self.solId
        self.log.append(f"Engine: Source language set to '{self.solId}'.")
        
        cache_key = f"search:{self.solId}:{self.target_word.lower()}"
        cached_tuple = cache.get(cache_key)
        
        db_num = self._get_cache_db_num()
        cache_location = f"Redis DB #{db_num}" if db_num is not None else "the configured cache"

        if cached_tuple:
            self.log.append(f"Engine: Cache HIT for key '{cache_key}' in {cache_location}.")
            status, data, messages, todo, result_count, self.translation_info, self.suggestions = cached_tuple
            state = SearchState.SUCCESS if status == 1 else SearchState.NOT_FOUND
            self._log_search(result_count, self.target_word)
            return self._get_response(status, data, messages, self.log, todo, state, self.suggestions)

        self.log.append(f"Engine: Cache MISS for key '{cache_key}' in {cache_location}.")

        if is_myanmar(self.target_word):
            self.solId = 'my'
            ome_handler = OmeData(self.target_word)
            status, data, messages, log_ome, todo, result_count = ome_handler.search()
            self.suggestions = []
            self.log.extend(log_ome)
            self._log_search(result_count, self.target_word)
            state = SearchState.SUCCESS if status == 1 else SearchState.NOT_FOUND
            response = self._get_response(status, data, messages, self.log, todo, state, self.suggestions)
            cache.set(cache_key, (status, data, messages, todo, result_count, self.translation_info, self.suggestions), timeout=3600)
            return response

        processed_word, display_context_word = self.target_word, self.target_word
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
        status, data, messages_oem, log_oem, todo, result_count, suggestions_oem = oem_handler.search()
        messages.extend(messages_oem); self.log.extend(log_oem); self.suggestions = suggestions_oem
        
        self._log_search(result_count, self.target_word)
        
        if data:
            word_data = data[0]
            if self.translation_info:
                term_obj = {
                    "source": {"word": display_context_word, "ipa": "", "lang": original_solId},
                    "target": {"word": word_data.get('word'), "ipa": word_data.get('ipa'), "lang": "en"}
                }
            else:
                lang_code = 'my' if is_myanmar(word_data.get('word', '')) else self.solId
                term_obj = {"source": {"word": word_data.get('word'), "ipa": word_data.get('ipa'), "lang": lang_code}}
            
            if 'word' in word_data: del word_data['word']
            if 'ipa' in word_data: del word_data['ipa']
            data[0] = {'term': term_obj, **word_data}
        
        state = SearchState.SUCCESS if status == 1 else SearchState.NOT_FOUND
        
        response = self._get_response(status, data, messages, self.log, todo, state, self.suggestions)
        if status == 1 or self.suggestions:
            cache.set(cache_key, (status, data, messages, todo, result_count, self.translation_info, self.suggestions), timeout=3600)
            self.log.append(f"Engine: Stored successful result/suggestion in cache for key '{cache_key}' in {cache_location}.")
            
        return response

    def _log_search(self, result_count, word_to_log):
        obj, created = LogSearch.objects.get_or_create(word=word_to_log, lang=self.solId, defaults={'count': 1, 'status': result_count})
        if not created:
            obj.count = F('count') + 1; obj.status = result_count
            obj.save(update_fields=['count', 'status', 'updated_at'])
        self.log.append(f"Engine: Logged search for '{word_to_log}' in lang '{self.solId}' with result count {result_count}.")

    def _validate_and_prepare_query(self):
        if not self.raw_query or not self.raw_query.strip(): return False
        query_str = self.raw_query.strip()
        if '~' in query_str:
            self.is_sentence = True
            sentence_part, target_part = query_str.split('~', 1)
            self.sentence_list = [word.strip() for word in sentence_part.strip().split(' ') if word.strip()]
            self.target_word = target_part.strip(".,;:?!'\"- ")
        else:
            words = [word.strip() for word in query_str.split(' ') if word.strip()]
            if len(words) > 1:
                self.is_sentence, self.sentence_list, self.target_word = True, words, words[0].strip(".,;:?!'\"- ")
            elif len(words) == 1:
                self.is_sentence, self.sentence_list, self.target_word = False, [], words[0].strip(".,;:?!'\"- ")
            else: return False
        return True

    def _generate_metadata(self, status, data, state):
        title = f"Search for '{self.target_word}' | {self.app_name}"
        if state == SearchState.INVALID_QUERY: title = f"Invalid Search | {self.app_name}"
        description = f"Search our comprehensive dictionary for millions of words and translations."
        keywords = f"{self.target_word}, dictionary, search, definition"
        if status == 1 and data:
            term_info = data[0].get('term', {})
            source_word = term_info.get('source', {}).get('word', self.target_word)
            if self.translation_info:
                all_langs = [lang for group in DICTIONARIES for lang in group['lang']]
                original_lang_id = self.solId
                if self.translation_info:
                    for group in DICTIONARIES:
                        for lang in group['lang']:
                            if self.target_word.lower() not in [w.lower() for w in self.sentence_list] and self.sentence_list and self.sentence_list[0].lower() not in [w.lower() for w in self.sentence_list]:
                                original_lang_id = lang['id']
                lang_name = next((item['name'] for item in all_langs if item["id"] == original_lang_id), original_lang_id)
                display_word = self.sentence_list[0] if self.is_sentence and self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list] else self.target_word
                title = f"{lang_name} to English translation for '{display_word}' | {self.app_name}"
                description = f"Translate '{display_word}' from {lang_name} to English. Get definitions for '{self.translation_info['primary']}' and explore alternative translations."
                keywords = f"{display_word}, {self.translation_info['primary']}, {lang_name} to English, translation, dictionary"
            else:
                title = f"Definition of {source_word} | {self.app_name}"
                try:
                    first_meaning_group = next(iter(data[0]['clue']['meaning'].values()))
                    first_sense_text = first_meaning_group[0]['sense'][0]['mean'][0]
                    description = f"Find the definition, synonyms, and pronunciation for {source_word}. The primary meaning is: '{first_sense_text}'."
                except (IndexError, KeyError, StopIteration):
                    description = f"Find the definition, synonyms, and pronunciation for {source_word} in our dictionary."
                kw_set = {source_word, 'definition', 'meaning', 'pronunciation'}
                for pos, meanings in data[0]['clue']['meaning'].items():
                    kw_set.add(pos)
                    for meaning in meanings:
                        if meaning['type'] == 'thesaurus': kw_set.update(meaning['exam']['value'][:5])
                keywords = ", ".join(kw_set)
        return {"title": title, "description": description, "keywords": keywords}

    def _get_cache_db_num(self):
        try: return cache.client.connection_pool.connection_kwargs.get('db', 0)
        except AttributeError: return None

    def _get_response(self, status, data, messages, log, todo, state, suggestions):
        query_target = self.target_word
        if self.is_sentence and self.target_word.isascii() and self.target_word.lower() not in [w.lower() for w in self.sentence_list]:
            query_target = self.sentence_list[0] if self.sentence_list else self.target_word
        query_context = {
            "is_sentence": self.is_sentence, "target_word": query_target,
            "input": " ".join(self.sentence_list) if self.sentence_list else self.target_word,
            "list": self.sentence_list
        }
        alternatives_list = []
        if self.translation_info:
            raw_alternatives = self.translation_info.get('alternatives', [])
            query_context_str = " ".join(self.sentence_list) if self.is_sentence else query_target
            for alt_word in raw_alternatives:
                alternatives_list.append({"word": alt_word, "query": f"{query_context_str}~{alt_word}"})
        translation_context = {
            "is_active": self.translation_info is not None,
            "primary_word": self.translation_info['primary'] if self.translation_info else "",
            "alternatives": alternatives_list
        }
        
        metadata = self._generate_metadata(status, data, state)

        # Build the final result object (without meta and todo)
        result_obj = {
            "state": state,
            "lang": self.solId,
            "log": log,
            "messages": messages,
            "query": query_context,
            "translation": translation_context,
            "suggestion": suggestions
        }

        # Construct the final response with top-level metadata
        return {
            "title": metadata.get("title", ""),
            "description": metadata.get("description", ""),
            "keywords": metadata.get("keywords", ""),
            "result": result_obj,
            "data": data
        }

