"""
version: 2025.09.07.2

Recent Updates:
- Added `meta.todo` field to the API response for better state communication.
- Engine now receives and forwards the `todo` list from the data handlers.
"""
# project/core/assist/search/engine.py
from ...utils import is_myanmar, is_known_nonlatin
from .ome import OmeData
from .oem import OemData

class DictionarySearch:
    """
    Main controller for the dictionary search engine.
    Delegates search logic to language-specific handlers (OEM/OME).
    """
    def __init__(self, raw_query):
        self.raw_query = raw_query
        self.query_sentence = ""
        self.current_word = ""
        self.status = 0
        self.messages = []
        self.data = []
        self.log = []
        self.todo = [] # New field for actionable tags

    def execute(self):
        """
        Main method to execute the search sequence.
        Validates the query, determines the language, and calls the appropriate handler.
        """
        try:
            if not self._validate_and_prepare_query():
                return self._get_response()

            # --- BRANCHING LOGIC: MYANMAR OR ENGLISH ---
            if is_myanmar(self.current_word):
                handler = OmeData(self.current_word)
            else:
                handler = OemData(self.current_word)
            
            # Unpack the new `todo` list from the handler's response
            self.status, self.data, self.messages, self.log, self.todo = handler.search()

        except Exception as e:
            self.status = 0
            self.messages.append(f"An unexpected server error occurred: {e}.")
            self.data = []
            self.log.append(f"ENGINE ERROR: An exception occurred: {e}")
        
        return self._get_response()

    def _validate_and_prepare_query(self):
        """
        Validates and sanitizes the raw query input.
        Extracts the current word to be searched.
        """
        if not self.raw_query or not self.raw_query.strip():
            self.messages.append("Query cannot be empty.")
            self.log.append("Validation failed: Query is empty.")
            return False
            
        if '~' in self.raw_query:
            self.query_sentence, self.current_word = self.raw_query.split('~', 1)
        else:
            self.query_sentence = self.raw_query
            # Get the first word for the search
            self.current_word = self.raw_query.strip().split(' ')[0]

        self.current_word = self.current_word.strip(".,;:?!'\"- ")
        self.log.append(f"Query validated. Current word set to: '{self.current_word}'.")
        return True
    
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
                "log": self.log,
                "todo": self.todo # Include the todo list in the response
            },
            "hint": {"name": "", "list": []},
            "status": self.status,
            "data": self.data
        }

