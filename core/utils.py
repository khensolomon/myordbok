import re

def is_myanmar(text):
    """
    Checks if the text contains Myanmar characters.
    """
    # Unicode range for Myanmar script
    myanmar_range = r'[\u1000-\u109F]'
    return re.search(myanmar_range, text) is not None

def is_known_nonlatin(text):
    """
    A simple check for some other non-latin scripts.
    This can be expanded as needed.
    """
    # Example: Cyrillic, Arabic, Hebrew
    non_latin_ranges = r'[\u0400-\u04FF]|[\u0600-\u06FF]|[\u0590-\u05FF]'
    return re.search(non_latin_ranges, text) is not None

def num_to_words(num_str):
    """
    Converts a number string to its word representation.
    This is a simplified version. A more robust library might be needed.
    """
    # Placeholder for number to word logic
    # e.g., using the 'num2words' library:
    # from num2words import num2words
    # try:
    #     return num2words(int(num_str))
    # except (ValueError, TypeError):
    #     return None
    
    if num_str == "100":
        return "one hundred"
    return None # Fallback for this example

# Placeholder for Math Expression Parser
def parse_math_expression(expression):
    """
    Safely evaluates a simple mathematical expression.
    """
    # IMPORTANT: Never use eval() on unsanitized user input in production.
    # This is a very basic and unsafe example. Use a dedicated library
    # like 'asteval' or 'numexpr' for safe evaluation.
    try:
        # Allow only numbers, +, -, *, /
        if all(c in '0123456789.+-*/() ' for c in expression):
            return eval(expression)
    except:
        return None
    return None

# Placeholder for linguistics functions
def get_verb_base(word):
    """

    Finds the base form of a verb (e.g., loved -> love).
    Requires a library like NLTK or spaCy for accurate lemmatization.
    """
    # Example using a simple rule (not for production)
    if word.endswith('ed'):
        return word[:-2]
    if word.endswith('ing'):
        return word[:-3]
    return word

def get_noun_singular(word):
    """
    Finds the singular form of a noun (e.g., kings -> king).
    Requires a library like NLTK or spaCy.
    """
    # Example using a simple rule (not for production)
    if word.endswith('s'):
        return word[:-1]
    return word
