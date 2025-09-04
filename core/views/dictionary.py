"""
dictionary.py
"""
from django.http import (
    HttpRequest, HttpResponse
)
from django.shortcuts import (
    render, redirect
)
from config import data
from ..assist.json_engine import SolInfo

def home(request: HttpRequest) -> HttpResponse:
    """
    1. Displays a complete list of all languages from all dictionaries.
    2. You can now use the data.DICTIONARIES variable in your Python code.
    For example, let's find the default language.

    More::

        default_lang = None
        for group in data.DICTIONARIES:
            for lang in group['lang']:
                if lang.get('default'):
                    default_lang = lang
                    break
            if default_lang:
                break
        
        print(f"The default language is: {default_lang['name']}")

    TODO

    - [ ] Handle empty data cases
    - [x] Add logging
    - [ ] Optimize loop performance

    """
    # all_languages = []
    # for dictionary_group in data.DICTIONARIES:
    #     all_languages.extend(dictionary_group['lang'])
    
    # # Optional: You can sort the list alphabetically by language name
    # all_languages_sorted = sorted(all_languages, key=lambda x: x['name'])

    raw = SolInfo.read(request.solId)

    return render(request, 'core/dictionary.html', {
            "title": raw['title'],
            "description": raw['description'],
            "keywords": raw['keyword'],
            "info": raw['info'],
            "dated": SolInfo.date(raw['dated']),
            "dictionaries": data.DICTIONARIES,
        }
    )

def detail(request: HttpRequest, lang_name: str) -> HttpResponse:
    """
    Verifies if a language exists. If it does, it sets a cookie with the
    language ID and redirects to the dictionary list. If not, it just
    redirects to the dictionary list.
    """
    found_lang_id = None
    # Flatten the list of languages to search easily
    for dictionary_group in data.DICTIONARIES:
        for lang in dictionary_group['lang']:
            # Case-insensitive comparison
            if lang['name'].lower() == lang_name.lower():
                found_lang_id = lang['id']
                break
        if found_lang_id:
            break

    # Always redirect back to the list page
    response = redirect('dictionary-home')

    # If the language was found, set the cookie on the response object
    if found_lang_id:
        # The cookie will be named 'solId' with the value of the language id
        response.set_cookie('solId', found_lang_id)
        
    return response
