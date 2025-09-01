import re
from .models import ListWord, ListSense, MapDerived
from .notation import myanmarNotation
# --- NLTK Integration ---
try:
    from nltk.corpus import wordnet
except ImportError:
    # This allows the app to run without NLTK, but thesaurus features will be disabled.
    wordnet = None

class DictionarySearch:
    """
    Handles the core logic for searching the dictionary based on the specifications in dse.md.
    """
    def __init__(self, raw_query):
        self.raw_query = raw_query
        self.query_sentence = ""
        self.current_word = ""
        self.status = 0  # 0: Not Found, 1: Found
        self.messages = [] # Changed to a list to handle multiple derivation messages
        self.data = []
        self.log = [] # Added for debugging the search sequence

    def execute(self):
        """
        Main method to execute the search sequence.
        Includes logic to handle numeric inputs using the notation module.
        """
        try:
            if not self._validate_and_prepare_query():
                return self._get_response()

            self.log.append(f"Initiating search for '{self.current_word}'.")
            word_entry = None
            senses = None
            notation_data = None

            # --- Handle Numeric Input ---
            if self.current_word.isdigit():
                self.log.append(f"'{self.current_word}' is numeric. Getting notations from MyanmarNotation module.")
                notation_data = myanmarNotation.get(self.current_word)

            # --- Standard Word Search Logic ---

            # 1. PRIMARY STRATEGY: Is the input word a known derived form?
            self.log.append(f"Step 1: Checking if '{self.current_word}' is a derived form in `map_derived`.")
            derived_mappings = MapDerived.objects.select_related('base_word', 'dete').filter(derived_word__word__iexact=self.current_word)
            
            first_mapping = derived_mappings.first()
            if first_mapping and first_mapping.base_word:
                base_word_entry = first_mapping.base_word
                self.log.append(f"Found derived form(s). Base word is '{base_word_entry.word}'. Checking for definitions.")
                
                senses_for_base = ListSense.objects.filter(word__iexact=base_word_entry.word).prefetch_related('wrte')
                if not senses_for_base.exists():
                    self.log.append(f"No definitions for '{base_word_entry.word}' in list_sense.word. Checking via wrid.")
                    senses_for_base = ListSense.objects.filter(wrid=base_word_entry).prefetch_related('wrte')

                if senses_for_base.exists():
                    word_entry = base_word_entry
                    senses = senses_for_base
                    for mapping in derived_mappings:
                        if mapping.base_word:
                            derivation_info = mapping.dete.derivation if mapping.dete and mapping.dete.derivation else 'a form'
                            message = f"'{self.current_word}' is {derivation_info} of '{mapping.base_word.word}'."
                            self.messages.append(message)
                    self.log.append(f"Definitions found for base word. Setting '{word_entry.word}' as primary result.")
                else:
                    self.log.append(f"Base word '{base_word_entry.word}' found, but it has no definitions. Continuing search.")
            else:
                 if derived_mappings.exists():
                     self.log.append(f"Found an orphaned derived mapping for '{self.current_word}'. Ignoring and proceeding.")
                 else:
                    self.log.append(f"'{self.current_word}' not found as a derived form. Proceeding to direct search.")

            # 2. FALLBACK STRATEGY: If not a derived word, search directly.
            if not word_entry:
                self.log.append(f"Step 2: Checking for direct definitions in `list_sense.word` for '{self.current_word}'.")
                senses_from_word_field = ListSense.objects.filter(word__iexact=self.current_word).prefetch_related('wrte')
                if senses_from_word_field.exists():
                    self.log.append("Found direct sense entries.")
                    senses = senses_from_word_field
                    word_entry = self._find_word_entry(self.current_word) or senses.first().wrid
                else:
                    self.log.append("No direct sense entries found. Checking `list_word`.")
                    direct_word_entry = self._find_word_entry(self.current_word)
                    if direct_word_entry:
                        senses_for_direct = ListSense.objects.filter(wrid=direct_word_entry).prefetch_related('wrte')
                        if senses_for_direct.exists():
                            word_entry = direct_word_entry
                            senses = senses_for_direct
                            self.log.append(f"Found word in `list_word` with definitions: '{word_entry.word}'.")
            
            # --- Final Evaluation ---
            if not (word_entry or senses or notation_data):
                self.messages.append(f"No definition found for '{self.current_word}'.")
                self.log.append("Search failed. No definitions or notations found.")
                return self._get_response()

            # --- Process and Structure Data ---
            self.status = 1
            self.log.append("Search successful. Structuring data.")
            self.data = self._structure_data(word_entry, senses, notation_data)

        except Exception as e:
            self.status = 0
            self.messages.append(f"An unexpected server error occurred: {e}.")
            self.data = []
            self.log.append(f"ERROR: An exception occurred: {e}")

        return self._get_response()

    def _validate_and_prepare_query(self):
        """
        Validates the input query and prepares it for searching.
        """
        if not self.raw_query or not self.raw_query.strip():
            self.messages.append("Query cannot be empty.")
            self.log.append("Validation failed: Query is empty.")
            return False
            
        if '~' in self.raw_query:
            self.query_sentence, self.current_word = self.raw_query.split('~', 1)
        else:
            self.query_sentence = self.raw_query
            self.current_word = self.raw_query.strip().split(' ')[0]

        self.current_word = self.current_word.strip(".,;:?!'\"- ").lower()
        # Do not lowercase if it's a number
        if not self.current_word.isdigit():
             self.current_word = self.current_word.lower()

        self.log.append(f"Query validated. Current word set to: '{self.current_word}'.")
        return True

    def _find_word_entry(self, word):
        """
        Finds the ListWord entry for a given word.
        """
        return ListWord.objects.filter(word__iexact=word).first()
        
    def _structure_data(self, word_entry, senses, notation_data=None):
        """
        Structures the found data into the format specified in api-json.md.
        Now includes logic to handle numeric notation data.
        """
        meanings = {}
        if senses:
            for sense in senses:
                pos_name = sense.wrte.name.lower() if sense.wrte and sense.wrte.name else 'unknown'
                if pos_name not in meanings:
                    meanings[pos_name] = []
                
                parsed_senses = self._parse_sense_field(sense.sense)

                exam_list = []
                if sense.exam:
                    temp_list = re.split(r'[;\n]', sense.exam)
                    exam_list = [item.strip() for item in temp_list if item.strip()]

                meanings[pos_name].append({
                    "id": sense.id,
                    "term": sense.word,
                    "sense": parsed_senses,
                    "type": "meaning",
                    "tag": ["sql"],
                    "exam": {
                        "type": "examSentence",
                        "value": exam_list
                    }
                })

        # --- Add numeric notation data if available ---
        if notation_data:
            self.log.append("Adding numeric notation data to the result.")
            pos_name = "number"
            if pos_name not in meanings:
                meanings[pos_name] = []
            
            burmese_digit = notation_data.get("number", "")
            word_notations = [n.get("sense") for n in notation_data.get("notation", []) if n.get("sense")]
            term_word = notation_data.get("digit", self.current_word)

            meanings[pos_name].append({
                "term": term_word,
                "type": "meaning",
                "tag": ["notation"],
                "sense": burmese_digit,
                "exam": {
                    "type": "examSentence",
                    "value": word_notations
                }
            })
        
        # --- Fetch and add derived forms ---
        if word_entry:
            derived_forms = MapDerived.objects.filter(base_word=word_entry).select_related('derived_word', 'dete', 'wrte')
            derived_by_pos = {}
            for form in derived_forms:
                pos_name = form.wrte.name.lower() if form.wrte and form.wrte.name else 'unknown'
                if pos_name not in derived_by_pos:
                    derived_by_pos[pos_name] = []
                
                derived_word_str = form.derived_word.word if form.derived_word else '[missing word]'
                derivation_str = form.dete.derivation if form.dete else 'derived'
                derivation_text = f"(-~-) <{derived_word_str}> ({derivation_str or 'derived'})"
                derived_by_pos[pos_name].append(derivation_text)

            for pos_name, derivations in derived_by_pos.items():
                if pos_name not in meanings:
                    meanings[pos_name] = []
                sense_string = "; ".join(derivations)
                meanings[pos_name].append({
                    "term": word_entry.word,
                    "type": "meaning",
                    "tag": ["part-of-speech"],
                    "sense": sense_string,
                    "exam": {"type": "examSentence", "value": []}
                })

        # --- NLTK Integration: Get Synonyms and Antonyms ---
        if word_entry:
            thesaurus_data = self._get_wordnet_thesaurus(word_entry.word)

            # Antonyms are now first
            if thesaurus_data['antonyms']:
                pos_name = "antonym"
                if pos_name not in meanings:
                    meanings[pos_name] = []
                meanings[pos_name].append({
                    "term": word_entry.word,
                    "type": "antonym", # Changed from "meaning"
                    "tag": ["wordnet", "antonym"],
                    "sense": f"Words opposite to <{word_entry.word}>.",
                    "exam": {
                        "type": "examWord",
                        "value": thesaurus_data['antonyms']
                    }
                })
            
            # Synonyms (thesaurus) are second
            if thesaurus_data['synonyms']:
                pos_name = "thesaurus"
                if pos_name not in meanings:
                    meanings[pos_name] = []
                meanings[pos_name].append({
                    "term": word_entry.word,
                    "type": "thesaurus", # Changed from "meaning"
                    "tag": ["wordnet", "synonym"],
                    "sense": f"Words related to <{word_entry.word}>.",
                    "exam": {
                        "type": "examWord",
                        "value": thesaurus_data['synonyms']
                    }
                })


        top_level_word = word_entry.word if word_entry else self.current_word
        if not meanings:
            return []

        return [{"word": top_level_word, "clue": {"meaning": meanings}}]

    def _get_wordnet_thesaurus(self, word):
        """
        Fetches synonyms and antonyms for a word using NLTK's WordNet.
        """
        if not wordnet:
            self.log.append("NLTK is not installed. Skipping thesaurus search.")
            return {"synonyms": [], "antonyms": []}

        synonyms = set()
        antonyms = set()
        
        self.log.append(f"Searching WordNet for '{word}'.")
        for syn in wordnet.synsets(word):
            for lemma in syn.lemmas():
                # Add synonyms, replacing underscores with spaces
                synonyms.add(lemma.name().replace('_', ' '))
                # Check for antonyms and add them
                if lemma.antonyms():
                    for ant in lemma.antonyms():
                        antonyms.add(ant.name().replace('_', ' '))
        
        # Remove the original word from the sets if it exists
        synonyms.discard(word)
        antonyms.discard(word)

        self.log.append(f"Found {len(synonyms)} synonyms and {len(antonyms)} antonyms.")
        return {"synonyms": sorted(list(synonyms)), "antonyms": sorted(list(antonyms))}

    def _parse_sense_field(self, raw_text):
        """
        Parses the custom format in the 'sense' field.
        """
        if not raw_text:
            return [{"mean": [], "exam": []}]

        sense_groups = raw_text.split(';')
        parsed_data = []

        for group in sense_groups:
            group = group.strip()
            if not group: continue

            exam_parts = []
            mean_prefixes = []
            
            text_to_process = group
            exam_matches = re.findall(r'\[([^:]*):([^\]]*)\]', group)
            
            for key, value in exam_matches:
                full_match_str = f"[{key}:{value}]"
                
                if key in ('', '~', 'or', 'and', 'etc'):
                    inner_value = value.strip()
                    if inner_value.startswith('<') and inner_value.endswith('>'):
                        inner_value = inner_value[1:-1] 

                    links = inner_value.split('/')
                    formatted_links = [f"<{link.strip()}>" for link in links]
                    
                    exam_string = ""
                    if key == '~':
                        exam_string = f"~ {', '.join(formatted_links)}"
                    elif key in ('or', 'and'):
                        if len(formatted_links) > 1:
                            exam_string = f"{', '.join(formatted_links[:-1])} {key} {formatted_links[-1]}"
                        else:
                            exam_string = ', '.join(formatted_links)
                    elif key == 'etc':
                         exam_string = f"{', '.join(formatted_links)}, etc."
                    else: 
                        exam_string = ', '.join(formatted_links)
                    
                    if exam_string:
                        exam_parts.append(exam_string)
                    text_to_process = text_to_process.replace(full_match_str, '', 1)
                
                else:
                    mean_prefixes.append(f"<{value.strip()}>")
                    text_to_process = text_to_process.replace(full_match_str, '', 1)

            mean_text = text_to_process.strip()
            
            if mean_prefixes:
                mean_text = (' '.join(mean_prefixes) + ' ' + mean_text).strip()
            
            mean_parts = [m.strip() for m in mean_text.split('\n') if m.strip()]
            
            if not mean_parts and mean_text:
                mean_parts = [mean_text]

            parsed_data.append({ "mean": mean_parts, "exam": exam_parts })
            
        return parsed_data if parsed_data else [{"mean": [raw_text], "exam": []}]

    def _get_response(self):
        """
        Constructs the final JSON response object.
        """
        return {
            "query": {
                "input": self.raw_query,
                "word": self.current_word,
                "sentence": self.query_sentence.split(' ')
            },
            "meta": { 
                "messages": self.messages,
                "log": self.log 
            },
            "hint": { "name": "", "list": [] },
            "status": self.status,
            "data": self.data
        }



