"""
Handles all database operations for the FontLog model. This is the new
data persistence layer, replacing the JSON file system.
"""
import logging
from django.db.models import F
from ...models import FontLog

log = logging.getLogger(__name__)

def get_font_type_enum(font_type_str: str):
    """Converts a string type to the corresponding model integer choice."""
    if font_type_str == 'primary': return FontLog.FontType.PRIMARY
    if font_type_str == 'secondary': return FontLog.FontType.SECONDARY
    if font_type_str == 'external': return FontLog.FontType.EXTERNAL
    # Default to secondary if the type is unknown
    return FontLog.FontType.SECONDARY

def get_all_font_stats():
    """
    Fetches all font logs from the database.

    Returns:
        A dictionary mapping each font filename to its FontLog database object.
    """
    return {log.file: log for log in FontLog.objects.all()}

def increment_view_count(font_name: str):
    """
    Atomically increments the view count for a specific font file.
    Uses F() expression to avoid race conditions.
    """
    FontLog.objects.filter(file=font_name).update(view=F('view') + 1)

def increment_download_count(font_name: str):
    """
    Atomically increments the download count for a specific font file.
    Uses F() expression to avoid race conditions.
    """
    FontLog.objects.filter(file=font_name).update(download=F('download') + 1)

def sync_font_record(font_name: str, font_type_str: str):
    """
    Ensures a record exists in the database for a font file found on disk.
    This is used by the scan command.
    """
    font_type_enum = get_font_type_enum(font_type_str)
    # get_or_create is an atomic and safe way to ensure the object exists.
    FontLog.objects.get_or_create(
        file=font_name,
        defaults={'types': font_type_enum}
    )

def get_font_log(font_name: str):
    """Retrieves a single font log entry from the database."""
    try:
        return FontLog.objects.get(file=font_name)
    except FontLog.DoesNotExist:
        return None

