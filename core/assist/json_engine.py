"""
JSON reader for 

class:

- [x] Thuddar
- [x] SolInfo
"""
from django.conf import settings
from datetime import datetime, timezone
from ..utils import read_json


class Thuddar:
    """
    A centralized class to handle file paths and reading of JSON data
    for the Thuddar documentation.
    """
    def __init__(self):
        """Initializes the data directory and file path configuration."""
        self.data_dir = settings.BASE_DIR / 'docs' / 'thuddar'
        self.file_paths = {
            'snap': self.data_dir / 'snap.json',
            'structure': self.data_dir / 'structure.json',
            'pos_template': str(self.data_dir / 'pos-{}.json')
        }

    def read_structure(self):
        """Reads and returns the content of the main structure.json file."""
        return read_json(self.file_paths['structure'])

    def read_pos(self, pos_slug: str):
        """
        Reads and returns the content of a specific part-of-speech file
        based on its slug (e.g., 'adjective.1.2').
        """
        file_path = self.file_paths['pos_template'].format(pos_slug)
        return read_json(file_path)

    def read_direct_include(self, item_id: str):
        """
        Reads a JSON file for direct inclusion (e.g., 'adjective.json').
        """
        file_path = self.data_dir / f"{item_id}.json"
        return read_json(file_path, default=[])

class SolInfo:
    """
    A centralized class to handle file paths and reading of JSON data
    for the Dictionary Info.
    Initializes the data directory and file path configuration.
    """
    data_dir = settings.BASE_DIR / 'docs' / 'info'
    file_paths = {
        'info': str(data_dir / '{}.json')
    }

    @classmethod
    def read(self, pos_slug: str):
        """
        Reads and returns the content of a specific part-of-speech file
        based on its slug (e.g., 'adjective.1.2').
        """
        file = self.file_paths['info'].format(pos_slug)
        return read_json(file)

    @classmethod
    def date(self, num: int):
        """
        Python’s datetime works with seconds, not milliseconds. So you just divide by 1000:
        UTC
        """
        dt = datetime.fromtimestamp(num / 1000, tz=timezone.utc)
        return dt
