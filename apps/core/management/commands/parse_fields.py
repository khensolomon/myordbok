"""
version: 2025.09.26.1

A Django management command for testing the dictionary's field parsers in isolation.
This tool helps debug complex parsing logic without running the full search engine.

### How to Use Your New Debugging Tool

You now have a powerful, isolated environment for testing the parser.

**1. To Test a Simple String:**
From your terminal, you can now run commands like this:
```bash
# Test the problematic string directly
python manage.py parse_fields "[] square bracket [~:bracket]"

# Test another case
python manage.py parse_fields "() ဝိုက်ကွင်း [~:bracket/parenthesis]"
```

**2. To Test a Complex, Multi-Line String from a File:**
First, create a text file (e.g., `project/tmp/test_case.txt`) with the complex definition you want to test. Then, run:
```bash
python manage.py parse_fields project/tmp/test_case.txt
"""
import os
import json
from django.core.management.base import BaseCommand
from core.assist.search.parser import parse_sense_field, parse_exam_field

class Command(BaseCommand):
    help = 'Parses a given string or file using the dictionary\'s field parsers for debugging.'

    def add_arguments(self, parser):
        """
        Adds command-line arguments to the command.
        """
        parser.add_argument(
            'input_source',
            type=str,
            help='The raw string to parse, or the path to a text file containing the string.'
        )
        parser.add_argument(
            '--mode',
            type=str,
            choices=['sense', 'exam'],
            default='sense',
            help='Specifies which parser to use: "sense" (default) or "exam".'
        )

    def handle(self, *args, **options):
        """
        The main logic for the command.
        """
        input_source = options['input_source']
        mode = options['mode']
        
        input_text = ""
        
        # Check if the input_source is a file
        if os.path.isfile(input_source):
            try:
                with open(input_source, 'r', encoding='utf-8') as f:
                    input_text = f.read()
                self.stdout.write(self.style.SUCCESS(f"Successfully read content from file: {input_source}"))
            except Exception as e:
                self.stderr.write(self.style.ERROR(f"Error reading file: {e}"))
                return
        else:
            # Treat it as a raw string
            input_text = input_source
            self.stdout.write(self.style.SUCCESS("Parsing raw string input."))

        self.stdout.write("-" * 30)
        
        # Select the parser function based on the mode
        if mode == 'sense':
            parser_func = parse_sense_field
            self.stdout.write("Using 'parse_sense_field' parser...")
        else:
            parser_func = parse_exam_field
            self.stdout.write("Using 'parse_exam_field' parser...")

        # Run the parser and get the result
        parsed_result = parser_func(input_text)
        
        # Pretty-print the JSON output
        pretty_json = json.dumps(parsed_result, indent=2, ensure_ascii=False)
        
        self.stdout.write("\n--- PARSED OUTPUT ---")
        self.stdout.write(pretty_json)
        self.stdout.write("--- END OF OUTPUT ---")