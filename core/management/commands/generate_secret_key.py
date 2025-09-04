"""
Django management command to generate a new SECRET_KEY.

Why the SECRET_KEY is important:
The SECRET_KEY is a unique, unpredictable value that is used for cryptographic signing in Django. 
It's a critical component of Django's security infrastructure and must be kept secret.

Where the SECRET_KEY is used:
- Session Management: To sign session data to prevent tampering.
- CSRF Protection: To sign Cross-Site Request Forgery (CSRF) tokens.
- Cryptographic Signing: For any use of the `django.core.signing` module, like password reset links.
- Messages Framework: To sign messages passed between requests.

What to do if the SECRET_KEY is leaked:
If the SECRET_KEY is ever exposed or compromised, a new one must be generated immediately and the old one replaced in the settings file.
Leaking this key would allow an attacker to forge session data and potentially gain unauthorized access to the application. 
Replacing the key will invalidate all existing sessions and any other signed data (like password reset links), which is a necessary security measure.
bash::

  python -c "from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())"
  or
  python manage.py generate_secret_key
"""
import secrets
import string

from django.core.management.base import BaseCommand


class Command(BaseCommand):
    """
    Django command to generate a new SECRET_KEY.
    """
    help = 'Generates and prints a new SECRET_KEY'

    def handle(self, *args, **options):
        """
        Handles the logic for the command.
        """
        prefix = 'myordbok-'
        key_length = 50
        random_length = key_length - len(prefix)

        # Manually generate a secret key to ensure compatibility with older Django versions.
        # Django's recommended characters are ASCII letters, digits, and punctuation.
        chars = string.ascii_letters + string.digits + string.punctuation
        
        random_part = ''.join(secrets.choice(chars) for _ in range(random_length))
        secret_key = f'{prefix}{random_part}'

        self.stdout.write(self.style.SUCCESS('SECRET_KEY generated successfully!'))
        self.stdout.write('') # Add a blank line for spacing
        self.stdout.write('SECRET_KEY is:')
        
        # Style the key to make it stand out
        self.stdout.write(self.style.WARNING(f'{secret_key}'))
        
        self.stdout.write('') # Add a blank line for spacing
        self.stdout.write('Copy the key and paste it into .env file.')

