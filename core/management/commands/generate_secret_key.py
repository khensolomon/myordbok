"""
Django management command to generate secure keys.

This script provides a robust way to generate Django SECRET_KEYs, URL-safe tokens,
and complex passwords directly from the command-line.

Installation:
    Place this file inside a Django app within the project at the following path:
    `app_name/management/commands/generate_secret_key.py`

Usage Examples:
    Standard key:    python manage.py generate_secret_key
    With prefix:     python manage.py generate_secret_key --prefix myordbok- --length 60
    URL-safe token:  python manage.py generate_secret_key --type urlsafe --length 43
"""
import secrets
import string

from django.core.management.base import BaseCommand

class Command(BaseCommand):
    """
    Generates and prints a new secure key (SECRET_KEY, urlsafe, or password).

    Why the SECRET_KEY is important:
    The SECRET_KEY is a unique, unpredictable value used for cryptographic signing in Django. 
    It is a critical component of Django's security infrastructure.

    Where the SECRET_KEY is used:
    - Session Management: To sign session data to prevent tampering.
    - CSRF Protection: To sign Cross-Site Request Forgery (CSRF) tokens.
    - Cryptographic Signing: For password reset links (via `django.core.signing`).
    - Messages Framework: To sign messages passed between requests.
    
    What to do if the SECRET_KEY is leaked:
    If compromised, generate a new one immediately and replace the old one in the settings or .env file. 
    This will invalidate existing sessions and signed data, securing the application.

    Command-line Examples:
      1. Standard Django key (50 chars):
         $ python manage.py generate_secret_key
      
      2. Custom prefix for Django key:
         $ python manage.py generate_secret_key --prefix "myordbok-" --length 65
         
      3. Generate a URL-safe token (e.g., for APIs or sessions):
         $ python manage.py generate_secret_key --type urlsafe --length 32
         
      4. Generate a highly complex password:
         $ python manage.py generate_secret_key --type password --length 24
    """
    help = 'Generates and prints a new secure key (SECRET_KEY, urlsafe, or password).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--type',
            type=str,
            choices=['django', 'urlsafe', 'password'],
            default='django',
            help='Type of key to generate. "django" strictly uses alphanumeric chars.'
        )
        parser.add_argument(
            '--length',
            type=int,
            default=50,
            help='Total length of the generated key (including prefix).'
        )
        parser.add_argument(
            '--prefix',
            type=str,
            default='',
            help='Optional prefix for the key (e.g., "myordbok-").'
        )

    def handle(self, *args, **options):
        """
        Handles the logic for the command.
        """
        key_type = options['type']
        length = options['length']
        prefix = options['prefix']

        # Validate that the prefix doesn't exceed the total desired length
        if length <= len(prefix):
            self.stderr.write(self.style.ERROR(
                f"Error: Target length ({length}) must be greater than prefix length ({len(prefix)})."
            ))
            return

        random_length = length - len(prefix)

        if key_type == 'django':
            # Strictly alphanumeric characters to ensure max compatibility
            chars = string.ascii_letters + string.digits
        
        elif key_type == 'urlsafe':
            # URL-safe characters only (avoids math.ceil and token_urlsafe slicing)
            chars = string.ascii_letters + string.digits + "-_"
            
        elif key_type == 'password':
            # Full punctuation for raw passwords
            chars = string.ascii_letters + string.digits + string.punctuation
            
        else:
            chars = string.ascii_letters + string.digits

        # Generate the random portion
        random_part = ''.join(secrets.choice(chars) for _ in range(random_length))
        secret_key = f'{prefix}{random_part}'

        self.stdout.write(self.style.SUCCESS(f'Successfully generated a {key_type} key!'))
        self.stdout.write('') # Add a blank line for spacing
        
        self.stdout.write(f'Key type: {key_type}, target length: {length}')
        
        # Style the key with a visual box to make it stand out
        border = "=" * len(secret_key)
        self.stdout.write(self.style.WARNING(border))
        self.stdout.write(self.style.WARNING(secret_key))
        self.stdout.write(self.style.WARNING(border))
        
        self.stdout.write('') # Add a blank line for spacing
        
        if key_type == 'django':
            self.stdout.write('Replace the SECRET_KEY value in the .env file.')