"""
version: 2025.09.07.1

Recent Updates:
- Added versioning docstring.
- Initial creation: Centralized parsing logic for sense and exam fields.
"""
# project/core/assist/search/parser.py
import re

def parse_exam_field(raw_text):
    """
    Parses a raw exam string into a list of sentences, splitting by semicolon or newline.
    """
    if not raw_text:
        return []
    items = re.split(r'[;\n]', raw_text)
    return [item.strip() for item in items if item.strip()]

def parse_sense_field(raw_text):
    """
    Parses the complex sense field with special bracket notations
    into a structured list of mean/exam objects.
    This function will be used by both OME and OEM handlers.
    """
    if not raw_text:
        return [{"mean": [], "exam": []}]

    sense_groups = raw_text.split(';')
    parsed_data = []

    for group in sense_groups:
        group = group.strip()
        if not group: continue

        mean_parts = []
        exam_parts = []
        
        # Handles formats like [key:value/value]
        bracket_matches = re.findall(r'\[([^:]*):([^\]]*)\]', group)
        
        for key, value in bracket_matches:
            links = [f"<{link.strip()}>" for link in value.split('/')]
            
            if not key: # e.g., [:<...>]
                exam_parts.append(", ".join(links))
            elif key == '~':
                exam_parts.append(f"~ {links[0]}")
            elif key in ('or', 'and') and len(links) > 1:
                exam_parts.append(f"{', '.join(links[:-1])} {key} {links[-1]}")
            elif key == 'etc':
                exam_parts.append(f"{', '.join(links)}, etc.")
            else: # e.g., [type:...] is treated as a mean part
                mean_parts.append(f"<{key}>")

        # The rest of the string is the main definition
        mean_text = re.sub(r'\[([^:]*):([^\]]*)\]', '', group).strip()
        
        # Handles simple angle brackets <...> in the remaining text
        mean_text_links = re.findall(r'<([^>]+)>', mean_text)
        for link in mean_text_links:
            mean_text = mean_text.replace(f"<{link}>", "")
            exam_parts.append(f"<{link}>")

        mean_parts.extend([m.strip() for m in mean_text.split('\n') if m.strip()])

        if mean_parts or exam_parts:
            parsed_data.append({ "mean": mean_parts, "exam": exam_parts })
        
    return parsed_data if parsed_data else [{"mean": [raw_text], "exam": []}]

