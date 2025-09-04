# Setup

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

python manage.py runserver
```

## Management

```bash
# Generate Secret Key Command
python manage.py generate_secret_key

python manage.py inspectdb type_word
python manage.py inspectdb list_word

python manage.py create_demo_posts --number 50
```

## Update

```bash
# Recommended
pip show django

# Check from within a Python shell.
python manage.py shell

# version 5.2.7 when 5.2.5
pip install --upgrade django
```

## Python

```bash
python -m venv venv
source venv/bin/activate    # Linux/macOS
venv\Scripts\activate       # Windows
pip install -r requirements.txt
pip install -r requirements-dev.txt

python --version
python -m pip --version
python -m ensurepip --upgrade


python -m pip install --upgrade pip
```

## NLTK

```python
# run: pip install nltk
import nltk
nltk.download('wordnet')
```
