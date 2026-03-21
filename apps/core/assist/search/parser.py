"""
version: 2025.09.27.5

Recent Updates:
- Refactored the parser to use a new common helper function,
  `_format_exam_tag`, for handling rich text formatting.
- Both `parse_sense_field` and `parse_exam_field` now use this common
  function, eliminating code duplication and improving maintainability.
- `parse_exam_field` is now capable of parsing rich text tags into a
  flat list of strings, as requested.
"""
import re

def find_root_form(word):
    """
    Finds a potential root form of a word based on a series of regex patterns.
    Designed to be easily expandable. Returns the root word or None.
    """
    # Patterns are tuples: (regex_pattern, replacement_string)
    # The regex should capture the root word in a group.
    patterns = [
        (re.compile(r"(\w+)'s$", re.IGNORECASE), r"\1"),
        # Future patterns can be added here, e.g., for 'ing', 'ed', etc.
    ]

    for pattern, _ in patterns:
        match = pattern.match(word)
        if match:
            root_word = match.group(1)
            # Add a simple check to avoid mangling very short words
            if len(root_word) > 1:
                return root_word
    
    return None

def _split_by_delimiters(raw_text):
    """
    (Core Logic) The simplest reusable function. Splits a raw string by
    semicolons or newlines and returns a clean list of non-empty strings.
    """
    if not raw_text:
        return []
    items = re.split(r'[;\n]', raw_text)
    return [item.strip() for item in items if item.strip()]

def _format_exam_tag(key, value):
    """
    (Core Logic) Formats a single key-value pair from an exam tag
    into a display-ready string (e.g., '~ <link>').
    Returns the formatted string, or None if the tag is invalid.
    """
    if not value and key == '':
        return None

    if '<' in value and '>' in value:
        links_str = value
    else:
        links = value.split('/')
        links_str = ", ".join([f"<{link.strip()}>" for link in links if link.strip()])

    if not links_str:
        return None

    if key == '~':
        return f"~ {links_str}"
    elif key in ('or', 'and'):
        link_parts = [f"<{link.strip()}>" for link in value.split('/') if link.strip()]
        if len(link_parts) > 1:
            return f"{', '.join(link_parts[:-1])} {key} {link_parts[-1]}"
        else:
            return links_str
    elif key == 'etc':
        return f"{links_str}, etc."
    else:  # Handles empty key and any other key
        return links_str

def parse_sense_field(raw_text):
    """
    (Shell) Parses a raw sense string into a structured list of meanings
    and examples. It separates definition text from exam tags.
    """
    if not raw_text:
        return [{"mean": [], "exam": []}]

    sense_groups = _split_by_delimiters(raw_text)
    
    parsed_data = []
    current_meanings = []

    for group in sense_groups:
        type_tag_match = re.match(r'\[type:([^\]]+)\](.*)', group)
        if type_tag_match:
            tag = type_tag_match.group(1).strip()
            text = type_tag_match.group(2).strip()
            current_meanings.append(f"<{tag}> {text}")
            continue
        
        exam_pattern = re.compile(r'\[([^:\]\[]*):([^\]\[]*)\]')
        exam_matches = exam_pattern.findall(group)
        mean_text = exam_pattern.sub('', group).strip()

        exam_parts = []
        for key, value in exam_matches:
            formatted_tag = _format_exam_tag(key, value)
            if formatted_tag:
                exam_parts.append(formatted_tag)

        if mean_text:
            if current_meanings:
                parsed_data.append({"mean": current_meanings, "exam": []})
                current_meanings = []
            
            parsed_data.append({
                "mean": [m.strip() for m in mean_text.split('\n') if m.strip()],
                "exam": exam_parts
            })
        elif exam_parts:
             if parsed_data:
                 parsed_data[-1]['exam'].extend(exam_parts)
             else:
                 parsed_data.append({"mean": [], "exam": exam_parts})

    if current_meanings:
         parsed_data.append({"mean": current_meanings, "exam": []})

    return parsed_data if parsed_data else [{"mean": [raw_text], "exam": []}]


def parse_exam_field(raw_text):
    """
    (Shell) Parses a raw exam string, including special formatting, into a
    simple list of fully formatted sentences. It integrates exam tags into the text.
    """
    groups = _split_by_delimiters(raw_text)
    formatted_groups = []
    exam_pattern = re.compile(r'\[([^:\]\[]*):([^\]\[]*)\]')

    for group in groups:
        def replacer(match):
            key, value = match.groups()
            formatted_tag = _format_exam_tag(key, value)
            return formatted_tag if formatted_tag is not None else ''

        # Replace all occurrences of the pattern with their formatted versions
        formatted_group = exam_pattern.sub(replacer, group)
        # Clean up extra whitespace that can result from replacements
        formatted_group = ' '.join(formatted_group.split()).strip()
        if formatted_group:
            formatted_groups.append(formatted_group)

    return formatted_groups

