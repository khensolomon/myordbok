"""
version: 2025.09.07.2

Recent Updates:
- Added `meta.todo` field for better state communication.
- Now tags words with "missing_definition" if they exist but lack senses.
"""
# project/core/assist/search/ome.py
import re
from ...models.ome import MedWord, MedSense
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
        Returns status, data, messages, log, and todo list.
        """
        self.log.append(f"OME: Myanmar word detected. Initiating search for '{self.current_word}'.")

        # Check if the input is a Myanmar number
        try:
            turned_word = myanmar_notation.turn(self.current_word)
            if turned_word.isdigit():
                self.log.append("OME: Myanmar numeric input detected.")
                notation_result = myanmar_notation.get(self.current_word)
                self.status = 1
                self.data = self._structure_notation_data(notation_result)
                return self.status, self.data, self.messages, self.log, self.todo
        except Exception:
            self.log.append(f"OME: '{self.current_word}' is not a number, proceeding with word search.")
            pass

        word_entry = MedWord.objects.filter(word=self.current_word).first()
        if not word_entry:
            self.messages.append(f"No definition found for '{self.current_word}'.")
            self.log.append("OME: Search failed. No entry in `med_word`.")
            return self.status, self.data, self.messages, self.log, self.todo

        senses = MedSense.objects.filter(wrid=word_entry).prefetch_related('wrte')
        if not senses.exists():
            self.messages.append(f"While the word '{self.current_word}' exists, it has no definitions yet.")
            self.log.append("OME: Word found, but no senses available in `med_sense`.")
            # Add the new todo tag
            self.todo.append("missing_definition")
            return self.status, self.data, self.messages, self.log, self.todo

        self.status = 1
        self.log.append(f"OME: Search successful. Structuring data for '{word_entry.word}'.")
        self.data = self._structure_data(word_entry, senses)
        
        return self.status, self.data, self.messages, self.log, self.todo

    def _structure_data(self, word_entry, senses):
        """
        Structures the response for a Myanmar word based on the OME models
        and the desired JSON output format.
        """
        meanings = {}
        for sense in senses:
            pos_name = sense.wrte.name.lower() if sense.wrte and sense.wrte.name else 'unknown'
            if pos_name not in meanings:
                meanings[pos_name] = []

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

        return [{
            "word": word_entry.word,
            "ipa": word_entry.ipa or "", 
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
        
        return [{
            "word": myanmar_digit,
            "ipa": "",
            "clue": {"meaning": {"number": [meaning_obj]}}
        }]

