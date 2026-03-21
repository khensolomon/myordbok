"""
Handles all interaction with the database for font logs and metadata.
This module is the single source of truth for the FONT_DIR configuration.
"""
import os
import logging
from django.conf import settings
from django.db.models import F
from django.utils import timezone
from ...models import ListFont, FontType, FontStatus
from . import ttf as ttf_parser

log = logging.getLogger(__name__)
FONT_DIR: str = getattr(settings, 'FONTS_DIR', os.path.join(settings.BASE_DIR, 'media', 'fonts'))

def get_font_path(font_type_str: str, font_name: str) -> str | None:
    if not font_name or font_type_str not in [ft.label for ft in FontType]:
        return None
    path = os.path.join(FONT_DIR, font_type_str, font_name)
    return path if os.path.exists(path) else None

def get_all_fonts_by_type():
    """Fetches all displayable font records (Active, Restricted), grouped by type."""
    all_fonts = ListFont.objects.filter(status__lt=FontStatus.DISABLED).order_by('name', 'file')
    return {
        'primary': [f for f in all_fonts if f.get_types_display() == 'primary'],
        'secondary': [f for f in all_fonts if f.get_types_display() == 'secondary'],
        'external': [f for f in all_fonts if f.get_types_display() == 'external'],
    }

def get_and_increment_font_view(font_type_str: str, font_name: str):
    """Retrieves a single displayable font and atomically increments its view count."""
    try:
        font_type_enum = FontType[font_type_str.upper()]
        font = ListFont.objects.get(types=font_type_enum, file=font_name, status__lt=FontStatus.DISABLED)
        font.view = F('view') + 1
        font.save(update_fields=['view'])
        font.refresh_from_db()
        return font
    except (ListFont.DoesNotExist, KeyError):
        return None

def get_font_for_download(font_type_str: str, font_name: str):
    """Checks if a font is ACTIVE, then increments download count."""
    try:
        font_type_enum = FontType[font_type_str.upper()]
        font = ListFont.objects.get(types=font_type_enum, file=font_name)
        if font.status == FontStatus.ACTIVE:
            font.download = F('download') + 1
            font.save(update_fields=['download'])
            return get_font_path(font_type_str, font_name)
        return None 
    except (ListFont.DoesNotExist, KeyError):
        return None

def sync_font_record(font_type_enum, file_path: str, filename: str):
    """Creates or updates a font record, preserving manually set statuses."""
    try:
        metadata = ttf_parser.get_ttf_info(file_path)
        if not metadata or 'tables' not in metadata or 'name' not in metadata['tables']:
            log.warning(f"Could not parse metadata for {filename}. Skipping.")
            return

        name_table = metadata['tables']['name']
        font, created = ListFont.objects.update_or_create(
            file=filename,
            defaults={
                'types': font_type_enum,
                'name': name_table.get('1', 'Unknown Font'),
                'version': name_table.get('5', 'N/A'),
                'family': name_table.get('2', 'N/A'),
                'last_scanned': timezone.now()
            }
        )
        if created or font.status == FontStatus.MISSING:
            font.status = FontStatus.ACTIVE
            font.save(update_fields=['status'])

    except Exception as e:
        log.error(f"Error syncing record for {filename}: {e}")

def scan_and_sync_database(font_type_str: str) -> str:
    """Scans a font directory and syncs the database, marking missing files."""
    try:
        font_type_enum = FontType[font_type_str.upper()]
    except KeyError:
        return f"Invalid font type '{font_type_str}' for scanning."

    type_dir = os.path.join(FONT_DIR, font_type_str)
    if not os.path.isdir(type_dir):
        return f"Directory not found for type '{font_type_str}' at {type_dir}."

    log.info(f"Starting scan for '{font_type_str}' in directory {type_dir}...")
    found_files = set()
    for filename in os.listdir(type_dir):
        if filename.lower().endswith('.ttf'):
            file_path = os.path.join(type_dir, filename)
            sync_font_record(font_type_enum, file_path, filename)
            found_files.add(filename)
    
    stale_fonts = ListFont.objects.filter(types=font_type_enum).exclude(file__in=found_files)
    if stale_fonts.exists():
        count = stale_fonts.update(status=FontStatus.MISSING)
        log.info(f"Marked {count} stale font records as 'Missing' for type '{font_type_str}'.")

    return f"Scan complete for '{font_type_str}'. Database is now in sync."

