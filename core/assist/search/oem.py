"""
version: 2025.09.16.6

Recent Updates:
- Changed the `type` for derived form summaries from "meaning" to "pos" for
  a more semantic and intuitive API structure.
"""
# <pro>/core/assist/search/oem.py
import re
import nltk
import inflect
from nltk.corpus import wordnet
from ...models import OemWord, OemSense, OemDerived, TypeWord
from ..notation import myanmar_notation
from .parser import parse_sense_field, parse_exam_field
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
        Main search method for English words.
        Returns status, data, messages, log, and todo list.
        """
        self.log.append(f"OEM: Initiating search for '{self.current_word}'.")
        word_entry = None
        senses = None

        # --- Refactored Search Sequence ---
        # 1. PRIMARY STRATEGY: Check for direct definitions in oem_sense first
        senses_from_word_field = OemSense.objects.filter(word__iexact=self.current_word).prefetch_related('wrte')
        if senses_from_word_field.exists():
            self.log.append("OEM: Found direct sense entries.")
            senses = senses_from_word_field
            word_entry = self._find_canonical_word_entry(self.current_word, senses.first().wrid)

        # 2. SECONDARY STRATEGY: If no direct senses, check if it's a derived form
        if not word_entry:
            self.log.append(f"OEM: Not in senses, checking if '{self.current_word}' is a derived form.")
            derived_mappings = OemDerived.objects.select_related('base_word', 'dete').filter(derived_word__word__iexact=self.current_word)
            if derived_mappings.exists():
                base_word_entry = derived_mappings.first().base_word
                if base_word_entry:
                    self.log.append(f"OEM: Found base word '{base_word_entry.word}'. Searching for its definitions.")
                    senses_for_base = self._get_senses_for_word(base_word_entry)
                    if senses_for_base.exists():
                        word_entry = base_word_entry
                        senses = senses_for_base
                        for dm in derived_mappings:
                            derivation_info = dm.dete.derivation if dm.dete else 'a form'
                            self.messages.append(f"'{self.current_word}' is {derivation_info} of '{word_entry.word}'.")
                else:
                    self.log.append(f"OEM: Found derived mapping for '{self.current_word}' but it has a broken base_word link.")

        # 3. TERTIARY STRATEGY: If still no result, check oem_word directly. This is the key check for the 'todo' tag.
        if not word_entry:
            self.log.append(f"OEM: Not a derived form with senses. Checking `oem_word` for '{self.current_word}'.")
            direct_word_entry = self._find_canonical_word_entry(self.current_word)
            if direct_word_entry:
                senses_for_direct = self._get_senses_for_word(direct_word_entry)
                if senses_for_direct.exists():
                    word_entry = direct_word_entry
                    senses = senses_for_direct
                else:
                    self.log.append(f"OEM: Found '{self.current_word}' in oem_word but it has no senses.")
                    self.todo.append("missing_definition")
                    self.messages.append(f"While the word '{self.current_word}' exists, it has no definitions yet.")
                    return self.status, self.data, self.messages, self.log, self.todo

        # 4. NUMBER HANDLING
        if not word_entry and self.current_word.isdigit():
            self.log.append("OEM: No DB entry found for number, creating placeholder to generate notation.")
            class WordEntryPlaceholder:
                def __init__(self, word_string):
                    self.word = word_string
            word_entry = WordEntryPlaceholder(self.current_word)

        # 5. DATA STRUCTURING
        if word_entry:
            self.status = 1
            self.log.append(f"OEM: Proceeding to structure data for '{word_entry.word}'.")
            self.data = self._structure_data(word_entry, senses)
            if not self.data or not self.data[0]['clue']['meaning']:
                self.status = 0
                self.data = []

        # FINAL MESSAGE
        if self.status == 0 and not self.todo:
            self.messages.append(f"No definition found for '{self.current_word}'.")
            self.log.append("OEM: Search failed. No definitions found or structured.")

        return self.status, self.data, self.messages, self.log, self.todo

    def _get_senses_for_word(self, word_entry):
        """A helper to get all senses for a given word_entry from all sources."""
        senses_from_wrid = OemSense.objects.filter(wrid=word_entry).prefetch_related('wrte')
        senses_from_word = OemSense.objects.filter(word__iexact=word_entry.word).prefetch_related('wrte')
        return (senses_from_wrid | senses_from_word).distinct()

    def _find_canonical_word_entry(self, word, fallback_wrid=None):
        """Finds the single best entry in oem_word, preferring a direct match."""
        entry = OemWord.objects.filter(word__iexact=word).first()
        if entry:
            return entry
        if fallback_wrid:
            return fallback_wrid
        return None

    def _structure_data(self, word_entry, senses):
        """
        Structures the full response object, including WordNet data grouped by POS.
        """
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
                    "type": "pos", # <-- CHANGED FROM "meaning"
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

        # 4. REFACTORED: Fetch and add Antonyms/Synonyms from WordNet, grouped by POS
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

