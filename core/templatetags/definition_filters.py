"""
Custom Django template filters for definition formatting.

version: 2025.09.28

Recent Updates:
- Added rule for <strong> tags: [text] -> <strong>text</strong>.
- Added splitting for angle bracket links: <school/course> -> <a ...>school</a>/<a ...>course</a>.
- Added rule for <small> tags: (-text-) -> <small>text</small>.
- Renamed filter from 'custom_format' to 'definition_filters'.
- Converts text within angle brackets, e.g., <text>, into a search link.
- Converts text within parentheses, e.g., (text), into an emphasized tag.
- Replaces various empty brackets like (), <>, {}, [] with styled spans.
"""
import re
from django import template
from django.urls import reverse, NoReverseMatch
from django.utils.safestring import mark_safe
from urllib.parse import urlencode

register = template.Library()

@register.filter(name='definition_filters')
def definition_filters(value):
    """
    Applies custom formatting rules to a string:
    1. <text> or <text/more> -> Creates search links.
    2. [text] -> <strong>text</strong>
    3. (text) -> <em>text</em>
    4. (-text-) -> <small>text</small>
    5. Empty brackets like (), <>, {}, [] are replaced with styled spans.
    """
    if not isinstance(value, str):
        return value

    # Rule 5: Handle empty brackets first as they are specific cases.
    # We use temporary placeholders to avoid conflicts with the regex rules below.
    replacements = {
        '()': "___EMPTY_PAREN___",
        '<>': "___EMPTY_ANGLE___",
        '{}': "___EMPTY_CURLY___",
        '[]': "___EMPTY_SQUARE___",
    }
    for old, new in replacements.items():
        value = value.replace(old, new)

    # Rule 1: Transform content within angle brackets into links using a named URL
    # Handles single terms <bracket> and multiple terms <school/course>
    def make_link(match):
        full_text = match.group(1).strip()
        
        def create_single_link(text_part):
            try:
                base_url = reverse('definition')
                query_string = urlencode({'q': text_part})
                url = f"{base_url}?{query_string}"
                return f'<a href="{url}">{text_part}</a>'
            except NoReverseMatch:
                return text_part # Return plain text if URL lookup fails

        if '/' in full_text:
            parts = [part.strip() for part in full_text.split('/')]
            linked_parts = [create_single_link(p) for p in parts if p]
            return '/'.join(linked_parts)
        else:
            return create_single_link(full_text)

    value = re.sub(r'<([^>]+)>', make_link, value)
    
    # Rule 2: Transform content within square brackets into <strong> tags
    # [sing] -> <strong>sing</strong>
    value = re.sub(r'\[([^\]]+)\]', r'<strong>\1</strong>', value)

    # Rule 4: Transform content within (-...-) into <small> tags
    # (-text-) -> <small>text</small>
    value = re.sub(r'\(-\s*(.*?)\s*-\)', r'<span>\1</span>', value)

    # Rule 3: Transform content within parentheses into <em> tags
    # (text) -> <em>text</em>
    value = re.sub(r'\(([^)]+)\)', r'<em>\1</em>', value)


    # Now, replace the placeholders with the final HTML
    final_html_replacements = {
        "___EMPTY_PAREN___": "<span class='bracket round parenthesis'>-</span>",
        "___EMPTY_ANGLE___": "<span class='bracket angle'>-</span>",
        "___EMPTY_CURLY___": "<span class='bracket curly'>-</span>",
        "___EMPTY_SQUARE___": "<span class='bracket square'>-</span>",
    }
    for placeholder, html in final_html_replacements.items():
        value = value.replace(placeholder, html)


    return mark_safe(value)

