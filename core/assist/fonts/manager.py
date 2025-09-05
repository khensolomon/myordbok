"""
Handles all core logic for finding, parsing, and managing font files.
This module is now a thin layer that orchestrates the data layer and file path logic.
"""
import re
import logging
from . import data as font_db

log = logging.getLogger(__name__)

def _shorten_digit(n: int) -> str:
    try:
        n = int(n)
        if abs(n) < 1000: return str(n)
    except (ValueError, TypeError): return "0"
    sign = '-' if n < 0 else ''
    n = abs(n)
    tiers = ['', 'k', 'm', 'b', 't']
    magnitude = 0
    while n >= 999.5 and magnitude < len(tiers) - 1:
        n /= 1000.0
        magnitude += 1
    suffix = tiers[magnitude]
    precision = 3 if n < 100 else 4
    formatted_val = f"{n:.{precision}g}"
    temp_str = f"{sign}{formatted_val}{suffix}"
    return temp_str if len(temp_str) <= 6 else f"{sign}{int(n)}{suffix}"

def get_font_context(font_type: str | None, font_name: str | None) -> dict:
    context = font_db.get_all_fonts_by_type()
    context['title'] = "My Fonts Collection"
    context['description'] = "A collection of typetrue fonts for every one"
    context['keywords'] = "Typetrue, ttf, fonts"

    for key, font_list in context.items():
        if isinstance(font_list, list):
            for font in font_list:
                font.total = _shorten_digit(font.view + font.download)

    if font_type and font_name:
        font_object = font_db.get_and_increment_font_view(font_type, font_name)
        if font_object:
            context['font_object'] = font_object
            context['type'] = font_type
            context['download'] = font_name
            font_path = font_db.get_font_path(font_type, font_name)
            if font_path:
                from . import ttf as ttf_parser
                raw_info = ttf_parser.get_ttf_info(font_path)
                context['font_info'] = raw_info
                if raw_info and 'tables' in raw_info and 'name' in raw_info['tables']:
                    name_table = raw_info['tables']['name']
                    font_family = name_table.get('1', '')
                    if font_family:
                        clean_title = ' '.join(font_family.split('_'))
                        context['title'] = clean_title
                        context['description'] = name_table.get('4', '') or name_table.get('7', '') or clean_title
                        context['keywords'] = ', '.join(filter(None, re.split(r'_+', font_family)))
        else:
            log.warning(f"Font not found in DB: type='{font_type}', name='{font_name}'")
            context['error_message'] = f"The font '{font_name}' could not be found in the '{font_type}' category."
            
    return context

