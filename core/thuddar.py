import json
from pathlib import Path
from django.conf import settings

class Thuddar:
    """
    A centralized class to handle file paths and reading of JSON data
    for the Thuddar documentation.
    """
    def __init__(self):
        """Initializes the data directory and file path configuration."""
        self.data_dir = Path(settings.BASE_DIR) / 'docs' / 'thuddar'
        self.file_paths = {
            'snap': self.data_dir / 'snap.json',
            'structure': self.data_dir / 'structure.json',
            'pos_template': str(self.data_dir / 'pos-{}.json')
        }

    def _read_json(self, file_path: Path, default=None):
        """
        Internal helper to read a JSON file and handle common errors.
        Returns the parsed JSON data or a default value on failure.
        """
        try:
            with file_path.open('r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return default

    def read_structure(self):
        """Reads and returns the content of the main structure.json file."""
        return self._read_json(self.file_paths['structure'])

    def read_pos(self, pos_slug: str):
        """
        Reads and returns the content of a specific part-of-speech file
        based on its slug (e.g., 'adjective.1.2').
        """
        file_path = Path(self.file_paths['pos_template'].format(pos_slug))
        return self._read_json(file_path)

    def read_direct_include(self, item_id: str):
        """
        Reads a JSON file for direct inclusion (e.g., 'adjective.json').
        """
        file_path = self.data_dir / f"{item_id}.json"
        return self._read_json(file_path, default=[])