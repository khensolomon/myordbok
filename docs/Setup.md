# Setup

```bash
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser

python manage.py runserver

python manage.py create_demo_posts --number 50

python manage.py inspectdb type_word
python manage.py inspectdb list_word


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
