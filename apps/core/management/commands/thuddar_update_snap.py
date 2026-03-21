"""
Generate thuddar snap
"""
import json
import re
from pathlib import Path

from django.core.management.base import BaseCommand, CommandError
from core.assist.json_engine import Thuddar


def _format_pos_name(name_id: str) -> str:
    """
    Converts a string like "Adjective 1.2" into "adjective.1.2".
    This mimics the JavaScript regex logic.
    """
    # Find all sequences of letters or numbers (including decimals).
    matches = re.findall(r'[a-zA-Z]+|[0-9]+(?:\.[0-9]+)?', name_id)
    return "-".join(matches).lower()


class Command(BaseCommand):
    """
    A Django management command to update the snap.json index based on
    the structure defined in structure.json and individual part-of-speech files.
    """
    help = 'Updates the snap.json index based on structure.json and pos-*.json files.'

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        # Instantiate Thuddar to handle all data loading and path management.
        self.thuddar = Thuddar()

    def _write_json(self, file_path: Path, data: dict):
        """Helper function to write data to a JSON file."""
        try:
            with file_path.open('w', encoding='utf-8') as f:
                # Write with no indentation and ensure UTF-8 characters are not escaped
                json.dump(data, f, indent=None, separators=(',', ':'), ensure_ascii=False)
            self.stdout.write(f"Data successfully written to {file_path}")
        except IOError as e:
            raise CommandError(f"Failed to write to file {file_path}: {e}")

    def handle(self, *args, **options):
        """The main logic for the command."""
        self.stdout.write(self.style.SUCCESS('Starting snap update process...'))

        # 1. Read the main structure file using the Thuddar class
        structure_path = self.thuddar.file_paths['structure']
        raw_data = self.thuddar.read_structure()
        if raw_data is None:
            raise CommandError(f"Could not read or parse structure file at {structure_path}. Aborting.")

        structure = raw_data.get('structure')
        if not isinstance(structure, dict) or 'file' not in structure:
            raise CommandError("Invalid structure.json: 'structure' key with a 'file' list is missing.")

        # Ensure 'chapter' list exists
        if 'chapter' not in raw_data:
            raw_data['chapter'] = []

        # 2. Process each item in the structure's file list
        for item in structure.get('file', []):
            if 'child' in item:
                # This item has children, process each part-of-speech file
                for name in item.get('child', []):
                    pos_slug = _format_pos_name(name)
                    row = self.thuddar.read_pos(pos_slug)

                    if not isinstance(row, dict) or 'info' not in row or 'root' not in row:
                        self.stdout.write(self.style.WARNING(f"  - Skipping invalid or empty pos file for slug: '{pos_slug}'"))
                        continue

                    # Determine the row's destination chapter ID
                    status = row.get('info', {}).get('status')
                    row_id = item['id'] if isinstance(status, (int, float)) and status > 0 else 'other'

                    # Clean up the row data as per the original script
                    if 'status' in row.get('info', {}):
                        del row['info']['status']
                    if 'note' in row.get('root', {}):
                        del row['root']['note']

                    # Ensure the destination chapter exists in the raw_data
                    if row_id not in raw_data:
                        raw_data[row_id] = []
                        if row_id not in raw_data['chapter']:
                           raw_data['chapter'].append(row_id)

                    # Append a filtered version of the row (only info and root)
                    filtered_row = {k: row[k] for k in ('info', 'root') if k in row}
                    raw_data[row_id].append(filtered_row)
                    self.stdout.write(f"  - Processed '{name}' into chapter '{row_id}'")

            else:
                # This is a direct file inclusion
                item_id = item.get('id')
                if not item_id:
                    continue

                if item_id not in raw_data['chapter']:
                    raw_data['chapter'].append(item_id)
                
                raw_data[item_id] = self.thuddar.read_direct_include(item_id)
                self.stdout.write(f"  - Processed direct file inclusion '{item_id}.json'")

        # 3. Final cleanup and writing to snap.json
        if 'structure' in raw_data:
            del raw_data['structure']

        self._write_json(self.thuddar.file_paths['snap'], raw_data)

        self.stdout.write(self.style.SUCCESS('Successfully updated snap.json.'))

