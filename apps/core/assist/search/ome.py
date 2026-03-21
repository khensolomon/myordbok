"""
version: 2025.09.28.1

Recent Updates:
- Refactored the data structure to match the professional standard set by OEM.
- The response now uses the same unambiguous `term` object with a `source` key,
  ensuring API consistency across all languages.
"""
# <pro>/core/assist/search/ome.py
import re
from ...models.ome import OmeWord, OmeSense, OmeThesaurus
from ..notation import myanmar_notation
from .parser import parse_sense_field, parse_exam_field

class OmeData:
    """
    Handles all data retrieval and structuring for Myanmar language searches.
    """
    def __init__(self, current_word):
        self.current_word = current_word
        self.status = 0
        self.data = []
        self.messages = []
        self.log = []
        self.todo = [] # Field for actionable tags

    def search(self):
        """
        Main search method for Myanmar words.
        Returns status, data, messages, log, todo list, and the result count.
        """
        self.log.append(f"OME: Myanmar word detected. Initiating search for '{self.current_word}'.")
        result_count = 0

        # Check if the input is a Myanmar number
        try:
            turned_word = myanmar_notation.turn(self.current_word)
            if turned_word.isdigit():
                self.log.append("OME: Myanmar numeric input detected.")
                notation_result = myanmar_notation.get(self.current_word)
                self.status = 1
                self.data = self._structure_notation_data(notation_result)
        except Exception:
            self.log.append(f"OME: '{self.current_word}' is not a number, proceeding with word search.")
            pass
        
        if not self.data:
            word_entry = OmeWord.objects.filter(word=self.current_word).first()
            if not word_entry:
                self.messages.append(f"No definition found for '{self.current_word}'.")
                self.log.append("OME: Search failed. No entry in `med_word`.")
            else:
                senses = OmeSense.objects.filter(wrid=word_entry).prefetch_related('wrte').order_by('wseq')
                if not senses.exists():
                    self.messages.append(f"While the word '{self.current_word}' exists, it has no definitions yet.")
                    self.log.append("OME: Word found, but no senses available in `med_sense`.")
                    self.todo.append("missing_definition")
                else:
                    self.status = 1
                    self.log.append(f"OME: Search successful. Structuring data for '{word_entry.word}'.")
                    self.data = self._structure_data(word_entry, senses)
        
        # --- Calculate the result count from the final data structure ---
        if self.data:
            meanings = self.data[0].get('clue', {}).get('meaning', {})
            result_count = sum(len(items) for items in meanings.values())
        
        # Ensure status reflects if there's actual content
        self.status = 1 if result_count > 0 else 0

        return self.status, self.data, self.messages, self.log, self.todo, result_count

    def _structure_data(self, word_entry, senses):
        """
        Structures the response for a Myanmar word based on the OME models
        and the desired JSON output format.
        """
        meanings = {}
        pos_to_wrte_map = {}

        for sense in senses:
            pos_name = sense.wrte.name.lower() if sense.wrte and sense.wrte.name else 'unknown'
            if pos_name not in meanings:
                meanings[pos_name] = []
                pos_to_wrte_map[pos_name] = sense.wrte

            parsed_senses = parse_sense_field(sense.sense)
            
            usage_value = [u.strip() for u in sense.usg.split(',')] if sense.usg else []
            usage_obj = {"type": "usageWord", "value": usage_value}

            meanings[pos_name].append({
              "term": word_entry.word,
              "sense": parsed_senses,
              "type": "meaning",
              "tag": ["db", "med"],
              "exam": {
                "type": "examSentence",
                "value": parse_exam_field(sense.exam)
              },
              "usage": usage_obj
            })

        for pos_name, wrte_obj in pos_to_wrte_map.items():
            if not wrte_obj: continue

            synonyms_qs = OmeThesaurus.objects.filter(wrid=word_entry, cate=wrte_obj).select_related('wlid')
            synonym_words = [item.wlid.word for item in synonyms_qs if item.wlid]

            if synonym_words:
                meanings[pos_name].append({
                    "term": word_entry.word,
                    "type": "thesaurus",
                    "tag": ["db", "med", "synonym"],
                    "sense": f"(-~-) {len(synonym_words)} word(s) related to <{word_entry.word}> as <{pos_name}>.",
                    "exam": {"type": "examWord", "value": sorted(synonym_words)}
                })
        
        # --- NEW: Build the standardized term object ---
        term_obj = {
            "source": {
                "word": word_entry.word,
                "ipa": word_entry.ipa or "",
                "lang": "my"
            }
        }

        return [{
            "term": term_obj,
            "clue": {
                "meaning": meanings
            }
        }]

    def _structure_notation_data(self, notation_result):
        """
        Structures the response for a Myanmar numeric query.
        """
        myanmar_digit = notation_result.get("number", "")
        english_digit = notation_result.get("digit", "")
        notations = notation_result.get("notation", [])
        
        sense_string = notations[0]['sense'] if notations else ""
        exam_values = [n['sense'] for n in notations]
        if english_digit not in exam_values:
            exam_values.append(english_digit)

        meaning_obj = {
            "term": myanmar_digit,
            "type": "meaning",
            "tag": ["notation"],
            "sense": sense_string,
            "exam": {"type": "examSentence", "value": exam_values},
            "usage": {"type": "usageWord", "value": []}
        }
        
        # --- NEW: Build the standardized term object for notations ---
        term_obj = {
            "source": {
                "word": myanmar_digit,
                "ipa": "",
                "lang": "my"
            }
        }

        return [{
            "term": term_obj,
            "clue": {"meaning": {"number": [meaning_obj]}}
        }]

