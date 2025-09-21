"""
version: 2025.09.18.5

Recent Updates:
- Removed all caching logic from this class. Caching is now handled
  centrally by the main `DictionarySearch` engine for a cleaner architecture.
"""
# <pro>/core/assist/search/oem.py
import re
import nltk
import inflect
from nltk.corpus import wordnet
from ...models import OemWord, OemSense, OemDerived, TypeWord, OemSpelling
from ..notation import myanmar_notation
from .parser import parse_sense_field, parse_exam_field, find_root_form
from .ipa import IpaGenerator

class OemData:
    """
    Handles all data retrieval and structuring for English language searches.
    """
    def __init__(self, current_word):
        self.current_word = current_word.lower()
        self.status = 0
        self.data = []
        self.messages = []
        self.log = []
        self.todo = [] # Field for actionable tags

    def search(self):
        """
        Main search method for English words. Caching is handled by the parent engine.
        """
        self.log.append(f"OEM: Initiating search for '{self.current_word}'.")

        # --- Search Passes ---
        # --- First Pass: Search for the original word ---
        self.status, self.data, messages, log, self.todo = self._perform_search(self.current_word)
        self.messages.extend(messages)
        self.log.extend(log)

        # --- Second Pass: If failed, try spelling correction ---
        if self.status == 0 and not self.todo:
            try:
                spelling_entry = OemSpelling.objects.get(word__iexact=self.current_word)
                equivalent = spelling_entry.equivalent
                if equivalent:
                    self.log.append(f"OEM: No direct result. Found spelling equivalent: '{self.current_word}' -> '{equivalent}'.")
                    self.messages.append(f"Showing results for '{equivalent}'.")
                    self.status, self.data, messages, log, self.todo = self._perform_search(equivalent)
                    self.messages.extend(messages)
                    self.log.extend(log)
                    if self.data:
                         self.data[0]['word'] = f"{self.current_word} ({self.data[0]['word']})"
            except OemSpelling.DoesNotExist:
                pass

        # --- Third Pass: If still failed, try finding a root form ---
        if self.status == 0 and not self.todo:
            root_form = find_root_form(self.current_word)
            if root_form:
                self.log.append(f"OEM: No direct result. Trying root form '{root_form}'.")
                self.messages.append(f"Showing results for '{root_form}'.")
                
                status, data, messages_root, log_root, todo_root = self._perform_search(root_form)
                self.messages.extend(messages_root)
                self.log.extend(log_root)
                self.todo.extend(todo_root)

                if status == 1:
                    self.status = status
                    self.data = data
                    if self.data:
                        self.data[0]['word'] = f"{self.current_word} ({self.data[0]['word']})"

        # --- Calculate the result count ---
        result_count = 0
        if self.data:
            meanings = self.data[0].get('clue', {}).get('meaning', {})
            result_count = sum(len(items) for items in meanings.values())
        self.status = 1 if result_count > 0 else 0
        if self.status == 0 and not self.todo:
            self.messages.append(f"No definition found for '{self.current_word}'.")
            self.log.append("OEM: Search failed through all methods.")

        return self.status, self.data, self.messages, self.log, self.todo, result_count

    def _perform_search(self, word_to_search):
        local_status = 0
        local_data = []
        local_messages = []
        local_log = []
        local_todo = []

        word_entry = None
        senses = None

        senses_from_word_field = OemSense.objects.filter(word__iexact=word_to_search).prefetch_related('wrte').order_by('wseq') # <-- RETAINED ORDERING
        if senses_from_word_field.exists():
            local_log.append(f"OEM Sub-Search '{word_to_search}': Found direct sense entries.")
            senses = senses_from_word_field
            word_entry = self._find_canonical_word_entry(word_to_search, senses.first().wrid)
        
        if not word_entry:
            derived_mappings = OemDerived.objects.select_related('base_word', 'dete').filter(derived_word__word__iexact=word_to_search)
            if derived_mappings.exists() and derived_mappings.first().base_word:
                base_word_entry = derived_mappings.first().base_word
                senses_for_base = self._get_senses_for_word(base_word_entry)
                if senses_for_base.exists():
                    word_entry = base_word_entry
                    senses = senses_for_base
                    for dm in derived_mappings:
                        derivation_info = dm.dete.derivation if dm.dete else 'a form'
                        local_messages.append(f"'{word_to_search}' is {derivation_info} of '{word_entry.word}'.")
        
        if not word_entry:
            direct_word_entry = self._find_canonical_word_entry(word_to_search)
            if direct_word_entry:
                senses_for_direct = self._get_senses_for_word(direct_word_entry)
                if senses_for_direct.exists():
                    word_entry = direct_word_entry
                    senses = senses_for_direct
                else:
                    local_log.append(f"OEM Sub-Search '{word_to_search}': Found in list_word but has no senses.")
                    local_todo.append("missing_definition")
                    local_messages.append(f"While the word '{word_to_search}' exists, it has no definitions yet.")
                    return 0, [], local_messages, local_log, local_todo
        
        if not word_entry and word_to_search.isdigit():
            class WordEntryPlaceholder:
                def __init__(self, word_string): self.word = word_string
            word_entry = WordEntryPlaceholder(word_to_search)

        if word_entry:
            local_status = 1
            local_data = self._structure_data(word_entry, senses)
            if not local_data or not local_data[0]['clue']['meaning']:
                local_status = 0
                local_data = []
        
        return local_status, local_data, local_messages, local_log, local_todo


    def _get_senses_for_word(self, word_entry):
        senses_from_wrid = OemSense.objects.filter(wrid=word_entry).prefetch_related('wrte')
        senses_from_word = OemSense.objects.filter(word__iexact=word_entry.word).prefetch_related('wrte')
        # Combine and order the final queryset
        return (senses_from_wrid | senses_from_word).distinct().order_by('wseq')

    def _find_canonical_word_entry(self, word, fallback_wrid=None):
        entry = OemWord.objects.filter(word__iexact=word).first()
        if entry:
            return entry
        if fallback_wrid:
            return fallback_wrid
        return None

    def _structure_data(self, word_entry, senses):
        meanings = {}
        
        # 1. Process standard definitions from the database
        if senses:
            for sense in senses:
                pos_name = sense.wrte.name.lower() if sense.wrte else 'unknown'
                if pos_name not in meanings:
                    meanings[pos_name] = []
                
                meanings[pos_name].append({
                    "id": sense.id,
                    "term": sense.word,
                    "sense": parse_sense_field(sense.sense),
                    "type": "meaning",
                    "tag": ["sql"],
                    "exam": {
                        "type": "examSentence",
                        "value": parse_exam_field(sense.exam)
                    }
                })
            
        # 2. Fetch and add derived forms (only if word_entry is a real DB object)
        if isinstance(word_entry, OemWord):
            derived_forms = OemDerived.objects.filter(base_word=word_entry).select_related('derived_word', 'dete', 'wrte')
            grouped_derivations = {}
            for form in derived_forms:
                pos_name = form.wrte.name.lower() if form.wrte and form.wrte.name else 'unknown'
                if pos_name not in grouped_derivations:
                    grouped_derivations[pos_name] = []
                
                derived_word_str = form.derived_word.word if form.derived_word else ''
                derivation_str = form.dete.derivation.lower() if form.dete and form.dete.derivation else 'derived'
                
                formatted_string = f"<{derived_word_str}> ({derivation_str})"
                grouped_derivations[pos_name].append(formatted_string)

            for pos_name, derivations in grouped_derivations.items():
                if pos_name not in meanings:
                    meanings[pos_name] = []
                
                sense_string = "~ " + "; ~ ".join(derivations)
                
                meanings[pos_name].append({
                    "term": word_entry.word,
                    "type": "pos",
                    "tag": ["part-of-speech"],
                    "sense": sense_string,
                    "exam": {"type": "examSentence", "value": []}
                })
            
        # 3. Add number notations if the query is a number
        if self.current_word.isdigit():
            p = inflect.engine()
            english_words = p.number_to_words(self.current_word)
            
            myanmar_notation_result = myanmar_notation.get(self.current_word)
            myanmar_digits = myanmar_notation_result.get("number", "")
            myanmar_words = ""
            if myanmar_notation_result.get("notation"):
                 myanmar_words = myanmar_notation_result["notation"][0].get("sense", "")

            meanings["number"] = [{
                "term": self.current_word,
                "type": "meaning",
                "tag": ["notation"],
                "sense": myanmar_digits,
                "exam": { "type": "examSentence", "value": [myanmar_words, english_words] }
            }]

        # 4. Fetch and add Antonyms/Synonyms from WordNet, grouped by POS
        if isinstance(word_entry, OemWord):
            synsets = wordnet.synsets(word_entry.word)
            pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 'r': 'adverb', 's': 'adjective'}
            grouped_synonyms = {}
            grouped_antonyms = {}

            for syn in synsets:
                pos_key = pos_map.get(syn.pos())
                if not pos_key: continue
                
                if pos_key not in grouped_synonyms:
                    grouped_synonyms[pos_key] = set()
                    grouped_antonyms[pos_key] = set()
                
                for lemma in syn.lemmas():
                    syn_word = lemma.name().replace('_', ' ')
                    if syn_word.lower() != self.current_word:
                        grouped_synonyms[pos_key].add(syn_word)
                    
                    if lemma.antonyms():
                        ant_word = lemma.antonyms()[0].name().replace('_', ' ')
                        if ant_word.lower() != self.current_word:
                            grouped_antonyms[pos_key].add(ant_word)

            for pos_name, antonym_set in grouped_antonyms.items():
                if antonym_set:
                    if pos_name not in meanings: meanings[pos_name] = []
                    meanings[pos_name].append({
                        "term": word_entry.word, "type": "antonym", "tag": ["wordnet"],
                        "sense": f"(-~-) {len(antonym_set)} word(s) opposite to <{word_entry.word}> as <{pos_name}>.",
                        "exam": {"type": "examWord", "value": sorted(list(antonym_set))}
                    })

            for pos_name, synonym_set in grouped_synonyms.items():
                if synonym_set:
                    if pos_name not in meanings: meanings[pos_name] = []
                    meanings[pos_name].append({
                        "term": word_entry.word, "type": "thesaurus", "tag": ["wordnet"],
                        "sense": f"(-~-) {len(synonym_set)} word(s) related to <{word_entry.word}> as <{pos_name}>.",
                        "exam": {"type": "examWord", "value": sorted(list(synonym_set))}
                    })

        if not meanings:
            return []

        ipa_transcription = ""
        if isinstance(word_entry, OemWord):
            ipa_transcription = IpaGenerator.get_ipa(word_entry.word)

        return [{"word": word_entry.word, "ipa": ipa_transcription, "clue": {"meaning": meanings}}]

