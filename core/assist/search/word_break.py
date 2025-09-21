"""
Morphological Deconstructor for English Words.

This script provides a class, WordBreak, that breaks down English words
into their constituent parts: prefixes, roots, and suffixes.

Version: 2025.09.17.8
"""
import re
import os
import sys
from pathlib import Path # Import Path from pathlib

# ... (rest of the class definition remains the same) ...

class WordBreak:
    """
    Provides static methods to deconstruct English words into their
    morphological components.
    """

    # --- CLASS-LEVEL CACHE for the lexicon ---
    _INTERNAL_LEXICON = None

    # ... (other class attributes remain the same) ...

    @staticmethod
    def _load_internal_lexicon():
        """
        Loads a self-contained lexicon of common English root words for
        compound splitting. This is now a class-level cache.
        """
        if WordBreak._INTERNAL_LEXICON is not None:
            return WordBreak._INTERNAL_LEXICON

        # --- CORRECTED PATH LOGIC ---
        # Get the path to the current script ('.../pro/core/assist/word_break.py')
        script_path = Path(__file__).resolve()
        # Navigate up three levels to the project root ('.../pro/')
        project_root = script_path.parent.parent.parent
        # Build the correct path to the lexicon file
        lexicon_path = project_root / 'docs' / 'wordbreak' / 'lexicon.csv'

        word_set = set()
        try:
            with open(lexicon_path, 'r', encoding='utf-8') as f:
                for line in f:
                    word_set.add(line.strip().lower())
        except FileNotFoundError:
            # Silently fail if lexicon is not found, so the script can
            # still work for non-compound words.
            pass

        WordBreak._INTERNAL_LEXICON = word_set
        return WordBreak._INTERNAL_LEXICON

    # ... (the rest of the script, including deconstruct, _split_compound_dynamically, etc., remains the same) ...
    @staticmethod
    def _split_compound_dynamically(text):
        """
        Attempts to split a word into two parts, where both parts are
        valid words found in the internal lexicon.
        This is a rule-based approach to compound words.
        """
        lexicon = WordBreak._load_internal_lexicon()
        if not lexicon:
            return None # Cannot split if lexicon is not loaded

        # Prioritize the longest possible first word (greedy approach)
        for i in range(len(text) - 1, 1, -1):
            part1 = text[:i]
            part2 = text[i:]

            # Ensure parts are a reasonable length
            if len(part1) < 2 or len(part2) < 2:
                continue

            if part1 in lexicon and part2 in lexicon:
                # Found a valid split
                return [part1, part2]

        return None # No valid split found

    @staticmethod
    def deconstruct(text):
        """
        Main method to start the deconstruction of a word.
        """
        result = []
        text = text.lower().strip()
        if not text:
            return []

        # 1. Check for irregular forms first
        if text in WordBreak.IRREGULAR_FORMS:
            base_word = WordBreak.IRREGULAR_FORMS[text]
            return [{'word': base_word, 'id': 1, 'original': text}]

        # 2. Check for base words that should not be split
        if text in WordBreak.KNOWN_BASE_FORMS:
            return [{'word': text, 'id': 1}]

        # 3. Attempt to split compound words dynamically
        compound_parts = WordBreak._split_compound_dynamically(text)
        if compound_parts:
            # If it's a compound, return the parts and stop.
            return [{'word': part, 'id': 1} for part in compound_parts]

        # 4. Regular word processing continues if not an irregular/base/compound form
        prefix, word = WordBreak._get_prefix(text)
        if prefix:
            result.append({'word': prefix, 'id': 0})
            WordBreak._joiner(word, result)
        else:
            WordBreak._joiner(text, result)

        return result
    
    # --- IRREGULAR FORMS LOOKUP (Checked first for accuracy) ---
    IRREGULAR_FORMS = {
        'better': 'good', 'best': 'good', 'worse': 'bad', 'worst': 'bad',
        'went': 'go', 'was': 'be', 'were': 'be', 'is': 'be', 'are': 'be', 'am': 'be',
        'saw': 'see', 'seen': 'see',
        'took': 'take', 'taken': 'take',
        'spoke': 'speak', 'spoken': 'speak',
        'wrote': 'write', 'written': 'write',
        'ate': 'eat', 'eaten': 'eat',
        'knew': 'know', 'known': 'know',
        'ran': 'run',
        'children': 'child', 'men': 'man', 'women': 'woman',
        'mice': 'mouse', 'teeth': 'tooth', 'feet': 'foot',
        'people': 'person',
        'geese': 'goose',
        'fungi': 'fungus', 'cacti': 'cactus',
        'phenomena': 'phenomenon', 'criteria': 'criterion'
    }

    # --- KNOWN BASE FORMS (Words that should not be deconstructed) ---
    KNOWN_BASE_FORMS = {
        'distance', 'discuss', 'disrupt', 'distribute', 'relation', 'receive',
        'rely', 'republic', 'pretty', 'press', 'preach', 'uncle', 'under',
        'unit', 'herring', 'morning', 'spring', 'thing', 'ceiling', 'king',
        'bed', 'seed', 'bleed', 'need', 'weed', 'embed', 'butter', 'water',
        'corner', 'mutter', 'bully', 'jelly', 'ally', 'family', 'witness',
        'harness', 'news', 'physics', 'mathematics', 'billiards', 'lens',
        'analysis', 'always', 'enemy', 'engine', 'mist', 'list'
    }

    # --- REGEX PATTERNS (compiled for efficiency) ---
    PREFIX_PATTERN = re.compile(r'^(un|non|re|dis|over|en|em)(.{2,})', re.IGNORECASE)
    PREFIX_PATTERN_SKIP = re.compile(r'^(?:dis(?:ru|t)|re(?:p|v|q|c|t|s|w|f|l(?!o))|uni|en(?:em|gin)|mist)', re.IGNORECASE)
    SUFFIX_PATTERN = re.compile(r'(.*)(ly|tory|ful|ness|less|able|ed|ing|tion|sion|tive|ment|ist)s?$', re.IGNORECASE)
    SUFFIX_PATTERN_SKIP = re.compile(r'^(?:fam|am|com|vi|mon|hi|or|aw|ap|eq|h|im|jo|mo|o|k|d|l|p|r|s|t|w|z).?(ly|tory|able|ful|ing)$', re.IGNORECASE)

    # --- SUFFIX TO ROOT TRANSFORMATION RULES ---
    SUFFIX_ROOT_RULES = [
        {'w': re.compile(r'ness$', re.IGNORECASE), 's': [(re.compile(r'([a-z])i$', re.IGNORECASE), r'\1y'), (re.compile(r'(ho)$', re.IGNORECASE), r'\1n')], 'skip': []},
        {'w': re.compile(r'ly$', re.IGNORECASE), 's': [(re.compile(r'(ful|nal)$', re.IGNORECASE), r'\1'), (re.compile(r'(c)al$', re.IGNORECASE), r'\1'), (re.compile(r'(rfu)$', re.IGNORECASE), r'\1l'), (re.compile(r'(tic)al$', re.IGNORECASE), r'\1'), (re.compile(r'(ab|ib|mb|ip)$', re.IGNORECASE), r'\1le'), (re.compile(r'(ur)$', re.IGNORECASE), r'\1l'), (re.compile(r'(t|r|s|a|h|d|z)i$', re.IGNORECASE), r'\1y'), (re.compile(r'(m)i$', re.IGNORECASE), r'\1'), (re.compile(r'k(e|i)$', re.IGNORECASE), 'kly')], 'skip': [re.compile(r'^(a|bu|je)l$', re.IGNORECASE)]},
        {'w': re.compile(r'able$', re.IGNORECASE), 's': [(re.compile(r'(ic|eci|str)$', re.IGNORECASE), r'\1ate'), (re.compile(r'(oti)$', re.IGNORECASE), r'\1ate'), (re.compile(r'(por)$', re.IGNORECASE), r'\1ate'), (re.compile(r'(lor|put|not|lac|liz|lim|eiv|mov)$', re.IGNORECASE), r'\1e'), (re.compile(r'(par)$', re.IGNORECASE), r'\1ate'), (re.compile(r'(lov)$', re.IGNORECASE), r'\1e'), (re.compile(r'([a-z])i$', re.IGNORECASE), r'\1y')], 'skip': []},
        {'w': re.compile(r'ful$', re.IGNORECASE), 's': [(re.compile(r'i$', re.IGNORECASE), 'y')], 'skip': []},
        {'w': re.compile(r'less$', re.IGNORECASE), 's': [(re.compile(r'(t)i$', re.IGNORECASE), r'\1y')], 'skip': []},
        {'w': re.compile(r'tory$', re.IGNORECASE), 's': [(re.compile(r'(m)ma$', re.IGNORECASE), r'\1e'), (re.compile(r'ta$', re.IGNORECASE), 'te'), (re.compile(r'(di|bi|en|ma|si)$', re.IGNORECASE), r'\1t'), (re.compile(r'(duc)$', re.IGNORECASE), r'\1e'), (re.compile(r'(f)ica$', re.IGNORECASE), r'\1y'), (re.compile(r'(ec|bu|la|ova|pa|ga|bra|da|ia)$', re.IGNORECASE), r'\1te'), (re.compile(r'(dic)$', re.IGNORECASE), r'\1ite'), (re.compile(r'(f)ac$', re.IGNORECASE), r'\1ice'), (re.compile(r'(v)a$', re.IGNORECASE), r'\1e')], 'skip': []},
        {'w': re.compile(r'tion$', re.IGNORECASE), 's': [(re.compile(r'(tata)$', re.IGNORECASE), r'\1re'), (re.compile(r'(ppl)e$', re.IGNORECASE), r'\1y'), (re.compile(r'(dic)$', re.IGNORECASE), r'\1tate'), (re.compile(r'([b]st)en$', re.IGNORECASE), r'\1ain'), (re.compile(r'(f)ica$', re.IGNORECASE), r'\1y'), (re.compile(r'(tten)$', re.IGNORECASE), r'\1d'), (re.compile(r'(en|mi|edi)$', re.IGNORECASE), r'\1t'), (re.compile(r'(nt|ept|est)a$', re.IGNORECASE), r'\1'), (re.compile(r'(os)i$', re.IGNORECASE), r'\1e'), (re.compile(r'(i)si$', re.IGNORECASE), r'\1re'), (re.compile(r'(?<!n)(o)t(a)$', re.IGNORECASE), r'\1\2t'), (re.compile(r'(pil|zon|lg|xamin|nnot)a$', re.IGNORECASE), r'\1e'), (re.compile(r'(i[sz])a$', re.IGNORECASE), r'\1e'), (re.compile(r'([auieo])$', re.IGNORECASE), r'\1te'), (re.compile(r'([cprs])$', re.IGNORECASE), r'\1t')], 'skip': [re.compile(r'^(e?mo)$', re.IGNORECASE), re.compile(r'(escrip|ndi|ump|lu(?!tion)|(?!abs|ev).lu|\bm?posi|ques|ap|lo|dormit|voca|nip)$', re.IGNORECASE)]},
        {'w': re.compile(r'sion$', re.IGNORECASE), 's': [(re.compile(r'([sc])en$', re.IGNORECASE), r'\1end'), (re.compile(r'([r])ver$', re.IGNORECASE), r'\1vert'), (re.compile(r'([l])o$', re.IGNORECASE), r'\1ode'), (re.compile(r'([di])vi$', re.IGNORECASE), r'\1vide'), (re.compile(r'([plau])$', re.IGNORECASE), r'\1se'), (re.compile(r'([tr])a$', re.IGNORECASE), r'\1ade')], 'skip': [re.compile(r'^(vi|man|pen)$', re.IGNORECASE)]},
        {'w': re.compile(r'tive$', re.IGNORECASE), 's': [(re.compile(r'([scrip|crea|collec|narra|locu])$', re.IGNORECASE), r'\1te'), (re.compile(r'([sen])$', re.IGNORECASE), r'\1d'), (re.compile(r'([sump])$', re.IGNORECASE), r'\1e')], 'skip': [re.compile(r'^(na|mo)$', re.IGNORECASE)]},
        {'w': re.compile(r'ment$', re.IGNORECASE), 's': [(re.compile(r'([dg])e$', re.IGNORECASE), r'\1'), (re.compile(r'([argu|judg])$', re.IGNORECASE), r'\1e')], 'skip': [re.compile(r'^(mo|argu|seg|ce)$', re.IGNORECASE)]},
        {'w': re.compile(r'ist$', re.IGNORECASE), 's': [(re.compile(r'([log|nom])$', re.IGNORECASE), r'\1y'), (re.compile(r'([art|tour|novel])$', re.IGNORECASE), r'\1')], 'skip': []},
        {'w': re.compile(r'ed$', re.IGNORECASE), 's': [(re.compile(r'(beli|quit|quir)$', re.IGNORECASE), r'\1e'), (re.compile(r'(^(str|spr|r|t|b|d|p)ing)$', re.IGNORECASE), r'\1'), (re.compile(r'([rhp]ing)$', re.IGNORECASE), r'\1e'), (re.compile(r'(((?!u)..a|lo|y|so.)th)$', re.IGNORECASE), r'\1e'), (re.compile(r'((^a|ca|ya|sy|^dou)(?:valan)?[c]h)$', re.IGNORECASE), r'\1e'), (re.compile(r'([zsv])$', re.IGNORECASE), r'\1e'), (re.compile(r'((?!o).o[mnk])$', re.IGNORECASE), r'\1e'), (re.compile(r'(pl|rc|nc|am|ac|ud|tl|(?<!o)ad|dl)$', re.IGNORECASE), r'\1e'), (re.compile(r'((?![0]).[ar]g)$', re.IGNORECASE), r'\1e'), (re.compile(r'([ucie]at)$', re.IGNORECASE), r'\1e'), (re.compile(r'([f]ut)$', re.IGNORECASE), r'\1e'), (re.compile(r'((?![eikouafcbd]).[aueios]t)$', re.IGNORECASE), r'\1e'), (re.compile(r'((?![uebdc]).[i]t)$', re.IGNORECASE), r'\1y'), (re.compile(r'([p].on)$', re.IGNORECASE), r'\1e'), (re.compile(r'((?!e).[aou]r)$', re.IGNORECASE), r'\1e'), (re.compile(r'^([a-z]i)$', re.IGNORECASE), r'\1e'), (re.compile(r'((ab|d|^e)y)$', re.IGNORECASE), r'\1e'), (re.compile(r'((p)a)$', re.IGNORECASE), r'\1e'), (re.compile(r'((?!o).(i|o|y)b)$', re.IGNORECASE), r'\1e'), (re.compile(r'[i]$', re.IGNORECASE), 'y'), (re.compile(r'(([blnpt])\2)$', re.IGNORECASE), r'\2')], 'skip': [re.compile(r'^(?=.{0,1}$)', re.IGNORECASE), re.compile(r'([e])$', re.IGNORECASE), re.compile(r'(ab)$', re.IGNORECASE)]},
        {'w': re.compile(r'ing$', re.IGNORECASE), 's': [(re.compile(r'([vr])$', re.IGNORECASE), r'\1e'), (re.compile(r'(([blnpt])\2)$', re.IGNORECASE), r'\2')], 'skip': [re.compile(r'(th)$', re.IGNORECASE), re.compile(r'(str|spr|awn)$', re.IGNORECASE)]}
    ]

    @staticmethod
    def _get_prefix(text):
        if not WordBreak.PREFIX_PATTERN_SKIP.search(text):
            match = WordBreak.PREFIX_PATTERN.match(text)
            if match:
                return match.groups()
        return None, text

    @staticmethod
    def _get_suffixes(text):
        match = WordBreak.SUFFIX_PATTERN.match(text)
        if match:
            parts = [part for part in match.groups() if part]
            if len(parts) > 1:
                return parts
        return None, None

    @staticmethod
    def _joiner(word, result):
        base, suffix = WordBreak._get_suffixes(word)
        if base and suffix and not WordBreak.SUFFIX_PATTERN_SKIP.search(word):
            for task in WordBreak.SUFFIX_ROOT_RULES:
                if task['w'].search(suffix):
                    is_skipped = any(skip_rule.search(base) for skip_rule in task['skip'])
                    if not is_skipped:
                        transformed = False
                        for pattern, replacement in task['s']:
                            if pattern.search(base):
                                new_base = pattern.sub(replacement, base, 1)
                                if new_base != base:
                                    WordBreak._joiner(new_base, result)
                                    transformed = True
                                    break
                        if transformed:
                            return
            # If no transformation rule applied, add the base word
            result.insert(0, {'word': base, 'id': 1})
        else:
            # If no suffix or skipped, add the word as is
            result.insert(0, {'word': word, 'id': 1})

def main():
    """
    Main function to run the script from the command line.
    Processes a file of words and writes the output to a new file.
    """
    if len(sys.argv) < 2:
        print("Usage: python word_break.py <input_filename>")
        print("\n--- Running Internal Test Suite ---")
        words_to_test = [
            "demonstrably", "loving", "unhappiness", "redistribution",
            "unluckily", "relation", "beautifully", "completed", "overqualified",
            "nontoxic", "penniless", "impression", "creative", "impossible",
            "judgment", "artist", "enlarge", "empower",
            "better", "best", "went", "children", "mice", "was",
            "spoke", "written", "fungi", "phenomena",
            "herring", "distance", "witness", "physics", "bully",
            "sunflower", "notebook", "pancake", "cannot", "firefly", "database", "blackboard"
        ]
        for word in words_to_test:
            parts = WordBreak.deconstruct(word)
            print(f"'{word}' -> {parts}")
        return

    input_filename = sys.argv[1]
    base, ext = os.path.splitext(input_filename)
    output_filename = f"{base}-wordbreak{ext}"

    try:
        with open(input_filename, 'r', encoding='utf-8') as infile, \
             open(output_filename, 'w', encoding='utf-8') as outfile:
            for line in infile:
                word = line.strip()
                if word:
                    parts = WordBreak.deconstruct(word)
                    output_line = f"'{word}' -> {parts}\n"
                    outfile.write(output_line)
        print(f"Processing complete. Output written to '{output_filename}'")
    except FileNotFoundError:
        print(f"Error: Input file '{input_filename}' not found.")
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == '__main__':
    main()

