"""
Handles all core logic for finding, parsing, and managing font files.
This module now orchestrates the TTF parser and the database data layer.
"""
import os
import re
import logging
from django.conf import settings
from . import ttf as ttf_parser
from . import data as font_db

log = logging.getLogger(__name__)

FONT_DIR: str = settings.FONTS_DIR

def _get_font_list_from_disk(font_type: str):
    """Scans a directory and parses TTF/OTF files for basic metadata."""
    catalogue_dir = os.path.join(FONT_DIR, font_type)
    if not os.path.isdir(catalogue_dir):
        return []

    fonts_metadata = []
    for filename in sorted(os.listdir(catalogue_dir)):
        if filename.lower().endswith(('.ttf', '.otf')):
            path = os.path.join(catalogue_dir, filename)
            info = ttf_parser.get_ttf_info(path)
            if info and 'meta' in info:
                props = {p['name']: p['text'] for p in info['meta']['property']}
                fonts_metadata.append({
                    "file": filename,
                    "name": props.get('font-family', 'Unknown'),
                    "version": props.get('version', 'N/A'),
                    "family": props.get('font-subfamily', 'N/A'),
                })
    return fonts_metadata

def _merge_disk_and_db_data():
    """Merges font metadata from disk with view/download stats from the database."""
    all_fonts_context = {}
    db_stats = font_db.get_all_font_stats()

    for font_type in ['primary', 'secondary', 'external']:
        disk_fonts = _get_font_list_from_disk(font_type)
        merged_list = []
        for font_meta in disk_fonts:
            stats = db_stats.get(font_meta['file'])
            if stats:
                font_meta['view'] = stats.view
                font_meta['download'] = stats.download
                font_meta['restrict'] = stats.restricted
            else:
                font_meta.update({'view': 0, 'download': 0, 'restrict': False})
            merged_list.append(font_meta)

        merged_list.sort(key=lambda x: (x.get('view', 0) + x.get('download', 0)), reverse=True)
        all_fonts_context[font_type] = merged_list
    return all_fonts_context

def get_font_path(font_type, font_name):
    """Constructs and validates the path to a font file, now with logging."""
    if not all([font_type, font_name]):
        return None
    
    path = os.path.join(FONT_DIR, font_type, font_name)
    
    log.info(f"Attempting to find font at full path: '{path}'")
    if os.path.exists(path):
        log.info(f"SUCCESS: Found file at '{path}'")
        return path
    else:
        log.error(f"FAILURE: File does NOT exist at '{path}'. Check case-sensitivity and filename.")
        return None


def get_font_context(font_type=None, font_name=None):
    """Prepares the context for the template, returning raw font info for the view to format."""
    if font_type and font_name:
        font_db.increment_view_count(font_name)

    context = _merge_disk_and_db_data()

    if font_type and font_name:
        font_path = get_font_path(font_type, font_name)
        if font_path:
            # Return the raw info for the view to process, breaking the circular import.
            context['font_info'] = ttf_parser.get_ttf_info(font_path)
            context['type'] = font_type
            context['download'] = font_name
        else:
            context['error_message'] = f"The font file '{font_name}' could not be found in the '{font_type}' directory on the server."
            
    return context

def scan_and_sync_database(font_type: str):
    """Scans a directory and ensures all found fonts have a DB record."""
    catalogue_dir = os.path.join(FONT_DIR, font_type)
    if not os.path.isdir(catalogue_dir):
        return f"Directory not found: {catalogue_dir}"

    count = 0
    for filename in os.listdir(catalogue_dir):
        if filename.lower().endswith(('.ttf', '.otf')):
            font_db.sync_font_record(filename, font_type)
            count += 1
    return f"Database sync complete for '{font_type}'. Found and synced {count} fonts."

def get_font_for_download(font_type, font_name):
    """Checks restrictions, increments download count, and returns the file path."""
    font_log = font_db.get_font_log(font_name)

    if font_log and font_log.restricted:
        return None

    path = get_font_path(font_type, font_name)
    if path:
        font_db.increment_download_count(font_name)
        return path
    return None

