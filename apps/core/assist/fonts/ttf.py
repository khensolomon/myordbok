"""
TTF Font Parser Utility (Pure Python)
This module provides a dependency-free implementation for parsing metadata
from .ttf and .otf font files.
"""
import struct
import logging

logging.basicConfig(level=logging.INFO)
log = logging.getLogger(__name__)

def _parse_name_table(file, table_offset):
    """Parses the 'name' table from the font file to extract metadata strings."""
    file.seek(table_offset)
    header_bytes = file.read(6)
    if len(header_bytes) < 6: return {}

    try:
        _, num_records, storage_offset = struct.unpack('>HHH', header_bytes)
    except struct.error:
        return {}

    storage_offset_abs = table_offset + storage_offset
    name_records = {}

    for _ in range(num_records):
        record_bytes = file.read(12)
        if len(record_bytes) < 12: break

        try:
            platform_id, _, _, name_id, length, offset = struct.unpack('>HHHHHH', record_bytes)
        except struct.error:
            break

        if platform_id not in [1, 3]: continue  # We only need Macintosh or Windows platforms

        current_pos = file.tell()
        file.seek(storage_offset_abs + offset)
        string_bytes = file.read(length)

        try:
            # Most modern fonts use UTF-16BE.
            text = string_bytes.decode('utf-16-be')
        except UnicodeDecodeError:
            try:
                # Fallback for older Mac fonts.
                text = string_bytes.decode('mac_roman')
            except UnicodeDecodeError:
                continue

        name_records[str(name_id)] = text.strip('\x00')
        file.seek(current_pos)

    return name_records


def get_ttf_info(font_path: str):
    """
    Parses a TTF or OTF font file and extracts its metadata.
    Returns a dictionary structured for use by the font_manager.
    """
    try:
        with open(font_path, 'rb') as f:
            f.seek(4)  # Skip sfnt version
            num_tables, = struct.unpack('>H', f.read(2))
            f.seek(12)  # Go to start of table directory

            name_table_offset = None
            for _ in range(num_tables):
                record_bytes = f.read(16)
                if len(record_bytes) < 16: break
                tag = record_bytes[:4].decode('latin1')
                if tag == 'name':
                    _, offset, _ = struct.unpack('>III', record_bytes[4:])
                    name_table_offset = offset
                    break

            if not name_table_offset:
                log.error(f"Could not find 'name' table in {font_path}")
                return None

            name_table_data = _parse_name_table(f, name_table_offset)
            if not name_table_data: return None

            # Prepare metadata for both scanning and detailed view
            meta_props = []
            prop_map = {'1': 'font-family', '2': 'font-subfamily', '5': 'version'}
            for name_id, text in name_table_data.items():
                if name_id in prop_map:
                    meta_props.append({'name': prop_map[name_id], 'text': text})

            return {'tables': {'name': name_table_data}, 'meta': {'property': meta_props}}

    except FileNotFoundError:
        log.error(f"Font file not found at '{font_path}'")
        return None
    except Exception as e:
        log.error(f"An unexpected error occurred while parsing '{font_path}': {e}")
        return None

