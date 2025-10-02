"""
version: 2025.09.28.1

Recent Updates:
- Implemented a new "suggestion" feature for a better user experience.
- When a word is found but has no definitions, the engine now looks for
  synonyms and antonyms from WordNet and related terms from the database
  to provide the user with helpful alternatives.
"""
# <pro>/core/assist/search/oem.py
import re
import nltk
import inflect
from nltk.corpus import wordnet
from ...models import OemWord, OemSense, OemDerived, TypeWord, OemSpelling, OemThesaurus
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
        self.todo = []
        self.suggestions = [] # New field for suggestions

    def search(self):
        """
        Main search method for English words. Now provides suggestions on failure.
        """
        self.log.append(f"OEM: Initiating search for '{self.current_word}'.")
        
        # --- Multi-pass search logic ---
        self.status, self.data, messages, log, self.todo, word_entry_found = self._run_search_passes()
        self.messages.extend(messages)
        self.log.extend(log)

        # --- NEW: Generate suggestions if search failed but the word exists ---
        if self.status == 0 and "missing_definition" in self.todo and word_entry_found:
            self.log.append(f"OEM: No definition found, but word exists. Generating suggestions for '{word_entry_found.word}'.")
            self.suggestions = self._get_suggestions(word_entry_found)
        
        result_count = 0
        if self.data:
            meanings = self.data[0].get('clue', {}).get('meaning', {})
            result_count = sum(len(items) for items in meanings.values())

        self.status = 1 if result_count > 0 else 0
        if self.status == 0 and not self.todo and not self.suggestions:
            self.messages.append(f"No definition found for '{self.current_word}'.")
            self.log.append("OEM: Search failed through all methods.")

        return self.status, self.data, self.messages, self.log, self.todo, result_count, self.suggestions

    def _run_search_passes(self):
        """Helper to contain the multi-pass logic, returns the final word entry if found."""
        status, data, messages, log, todo = (0, [], [], [], [])
        word_entry = None
        
        # First Pass
        status, data, messages, log, todo, word_entry = self._perform_search(self.current_word)
        if status == 1: return status, data, messages, log, todo, word_entry

        # Second Pass
        try:
            spelling_entry = OemSpelling.objects.get(word__iexact=self.current_word)
            equivalent = spelling_entry.equivalent
            if equivalent:
                log.append(f"OEM: Found spelling equivalent: '{self.current_word}' -> '{equivalent}'.")
                messages.append(f"Showing results for '{equivalent}'.")
                status, data, msg_eq, log_eq, todo_eq, word_entry = self._perform_search(equivalent)
                messages.extend(msg_eq); log.extend(log_eq); todo.extend(todo_eq)
                if data: data[0]['word'] = f"{self.current_word} ({data[0]['word']})"
                if status == 1: return status, data, messages, log, todo, word_entry
        except OemSpelling.DoesNotExist: pass

        # Third Pass
        root_form = find_root_form(self.current_word)
        if root_form:
            log.append(f"OEM: Trying root form '{root_form}'.")
            messages.append(f"Showing results for '{root_form}'.")
            status, data, msg_root, log_root, todo_root, word_entry = self._perform_search(root_form)
            messages.extend(msg_root); log.extend(log_root); todo.extend(todo_root)
            if data: data[0]['word'] = f"{self.current_word} ({data[0]['word']})"
            if status == 1: return status, data, messages, log, todo, word_entry
        
        return status, data, messages, log, todo, word_entry


    def _get_suggestions(self, word_entry):
        """
        Generates a list of suggestions (synonyms, antonyms, etc.) for a word
        that exists but has no definition.
        """
        suggestions = []
        
        # 1. Get related words from OemThesaurus
        try:
            db_thesaurus = OemThesaurus.objects.filter(wrid=word_entry).select_related('wlid')
            related_words = [item.wlid.word for item in db_thesaurus if item.wlid]
            if related_words:
                suggestions.append({
                    "type": "related",
                    "source": "database",
                    "value": sorted(list(set(related_words)))
                })
        except Exception:
            self.log.append(f"OEM: Error querying OemThesaurus for suggestions.")
            pass

        # 2. Get synonyms and antonyms from WordNet
        try:
            synonyms = set()
            antonyms = set()
            for syn in wordnet.synsets(word_entry.word):
                for lemma in syn.lemmas():
                    syn_word = lemma.name().replace('_', ' ')
                    if syn_word.lower() != word_entry.word.lower():
                        synonyms.add(syn_word)
                    if lemma.antonyms():
                        ant_word = lemma.antonyms()[0].name().replace('_', ' ')
                        antonyms.add(ant_word)
            
            if synonyms:
                suggestions.append({
                    "type": "synonym",
                    "source": "wordnet",
                    "value": sorted(list(synonyms))
                })
            if antonyms:
                suggestions.append({
                    "type": "antonym",
                    "source": "wordnet",
                    "value": sorted(list(antonyms))
                })
        except Exception:
            self.log.append(f"OEM: Error querying WordNet for suggestions.")
            pass
            
        return suggestions


    def _perform_search(self, word_to_search):
        # ... existing search logic ...
        # IMPORTANT CHANGE: This method now returns the found `word_entry` object
        # ... (code is largely the same, but the final return is different) ...
        # ... at the end of the method ...
        local_status, local_data, local_messages, local_log, local_todo = (0, [], [], [], [])
        word_entry = None
        senses = None
        senses_from_word_field = OemSense.objects.filter(word__iexact=word_to_search).prefetch_related('wrte').order_by('wseq')
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
                    return 0, [], local_messages, local_log, local_todo, direct_word_entry
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
        return local_status, local_data, local_messages, local_log, local_todo, word_entry

    def _get_senses_for_word(self, word_entry):
        senses_from_wrid = OemSense.objects.filter(wrid=word_entry).prefetch_related('wrte')
        senses_from_word = OemSense.objects.filter(word__iexact=word_entry.word).prefetch_related('wrte')
        return (senses_from_wrid | senses_from_word).distinct().order_by('wseq')

    def _find_canonical_word_entry(self, word, fallback_wrid=None):
        entry = OemWord.objects.filter(word__iexact=word).first()
        if entry: return entry
        if fallback_wrid: return fallback_wrid
        return None

    def _structure_data(self, word_entry, senses):
        meanings = {}
        if senses:
            for sense in senses:
                pos_name = sense.wrte.name.lower() if sense.wrte else 'unknown'
                if pos_name not in meanings: meanings[pos_name] = []
                meanings[pos_name].append({
                    "id": sense.id, "term": sense.word,
                    "sense": parse_sense_field(sense.sense), "type": "meaning", "tag": ["sql"],
                    "exam": { "type": "examSentence", "value": parse_exam_field(sense.exam) }
                })
        if isinstance(word_entry, OemWord):
            derived_forms = OemDerived.objects.filter(base_word=word_entry).select_related('derived_word', 'dete', 'wrte')
            grouped_derivations = {}
            for form in derived_forms:
                pos_name = form.wrte.name.lower() if form.wrte and form.wrte.name else 'unknown'
                if pos_name not in grouped_derivations: grouped_derivations[pos_name] = []
                derived_word_str = form.derived_word.word if form.derived_word else ''
                derivation_str = form.dete.derivation.lower() if form.dete and form.dete.derivation else 'derived'
                formatted_string = f"<{derived_word_str}> ({derivation_str})"
                grouped_derivations[pos_name].append(formatted_string)
            for pos_name, derivations in grouped_derivations.items():
                if pos_name not in meanings: meanings[pos_name] = []
                sense_string = "~ " + "; ~ ".join(derivations)
                meanings[pos_name].append({
                    "term": word_entry.word, "type": "pos", "tag": ["part-of-speech"],
                    "sense": sense_string, "exam": {"type": "examSentence", "value": []}
                })
        if self.current_word.isdigit():
            p = inflect.engine()
            english_words = p.number_to_words(self.current_word)
            myanmar_notation_result = myanmar_notation.get(self.current_word)
            myanmar_digits = myanmar_notation_result.get("number", "")
            myanmar_words = myanmar_notation_result.get("notation", [{}])[0].get("sense", "")
            meanings["number"] = [{
                "term": self.current_word, "type": "meaning", "tag": ["notation"],
                "sense": myanmar_digits,
                "exam": { "type": "examSentence", "value": [myanmar_words, english_words] }
            }]
        if isinstance(word_entry, OemWord):
            synsets = wordnet.synsets(word_entry.word)
            pos_map = {'n': 'noun', 'v': 'verb', 'a': 'adjective', 'r': 'adverb', 's': 'adjective'}
            grouped_synonyms, grouped_antonyms = {}, {}
            for syn in synsets:
                pos_key = pos_map.get(syn.pos())
                if not pos_key: continue
                if pos_key not in grouped_synonyms:
                    grouped_synonyms[pos_key], grouped_antonyms[pos_key] = set(), set()
                for lemma in syn.lemmas():
                    syn_word = lemma.name().replace('_', ' ')
                    if syn_word.lower() != self.current_word: grouped_synonyms[pos_key].add(syn_word)
                    if lemma.antonyms():
                        ant_word = lemma.antonyms()[0].name().replace('_', ' ')
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
        if not meanings: return []
        ipa_transcription = IpaGenerator.get_ipa(word_entry.word) if isinstance(word_entry, OemWord) else ""
        return [{"word": word_entry.word, "ipa": ipa_transcription, "clue": {"meaning": meanings}}]

