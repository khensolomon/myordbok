"""
version: 2025.09.17.4

Recent Updates:
- Added a new `find_root_form` function to handle contractions and other
  patterns in an expandable, regex-based way.
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

def parse_sense_field(raw_text):
    """
    Parses a raw sense string into a structured list of meanings and examples,
    handling custom formatting like [key:value] and <links>.
    """
    # ... (existing implementation)
    if not raw_text:
        return [{"mean": [], "exam": []}]

    sense_groups = re.split(r'[;\n]', raw_text)
    parsed_data = []
    current_meanings = []

    for group in sense_groups:
        group = group.strip()
        if not group: continue

        # Handle type tags like [type:mathematics]
        type_tag_match = re.match(r'\[type:([^\]]+)\](.*)', group)
        if type_tag_match:
            tag = type_tag_match.group(1).strip()
            text = type_tag_match.group(2).strip()
            current_meanings.append(f"<{tag}> {text}")
            continue

        # Handle exam tags like [:...], [or:...], etc.
        exam_matches = re.findall(r'\[([^:]*):([^\]]*)\]', group)
        exam_parts = []
        for key, value in exam_matches:
            # Check if value already contains angle brackets
            if '<' in value and '>' in value:
                links_str = value
            else:
                links = value.split('/')
                links_str = ", ".join([f"<{link.strip()}>" for link in links])
            
            if key == '~':
                exam_parts.append(f"~ {links_str}")
            elif key in ('or', 'and'):
                # Special handling for or/and to create a sentence
                link_parts = [f"<{link.strip()}>" for link in value.split('/')]
                if len(link_parts) > 1:
                    exam_parts.append(f"{', '.join(link_parts[:-1])} {key} {link_parts[-1]}")
                else:
                    exam_parts.append(links_str)
            elif key == 'etc':
                 exam_parts.append(f"{links_str}, etc.")
            else: # Handles empty key and any other key
                exam_parts.append(links_str)

        mean_text = re.sub(r'\[([^:]*):([^\]]*)\]', '', group).strip()
        
        if mean_text:
            if current_meanings:
                # Attach previous meanings to this new block
                parsed_data.append({"mean": current_meanings, "exam": []})
                current_meanings = []
            
            parsed_data.append({
                "mean": [m.strip() for m in mean_text.split('\n') if m.strip()],
                "exam": exam_parts
            })
        elif exam_parts:
             # This is a line with only an exam part
             if parsed_data:
                 parsed_data[-1]['exam'].extend(exam_parts)
             else:
                 parsed_data.append({"mean": [], "exam": exam_parts})


    if current_meanings:
         parsed_data.append({"mean": current_meanings, "exam": []})

    return parsed_data if parsed_data else [{"mean": [raw_text], "exam": []}]

def parse_exam_field(raw_text):
    """
    Parses a raw exam string from the database into a list of sentences.
    Splits by both semicolons and newlines.
    """
    if not raw_text:
        return []
    items = re.split(r'[;\n]', raw_text)
    return [item.strip() for item in items if item.strip()]

