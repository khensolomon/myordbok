"""
grammar.py
"""
# from django.shortcuts import render
# from .models import Note # Import the Note model
from django.http import (
    HttpRequest, HttpResponse
)
from django.shortcuts import (
    render
)
from ..assist.json_engine import (
    Thuddar
)

def home(request: HttpRequest) -> HttpResponse:
    """
    View for the main /grammar/ page.
    Displays a list of all parts of speech from snap.json.
    """

    snap_data = Thuddar().read_direct_include('snap')

    # The context is what gets passed to the template
    context = {
        'title': snap_data.get('context', {}).get('name', 'Grammar'),
        'description': snap_data.get('context', {}).get('desc', ''),
        'grammar': snap_data,
    }
    return render(request, 'core/grammar-list.html', context)

def detail(request: HttpRequest, pos_slug: str) -> HttpResponse:
    """
    View for the detail page, e.g., /grammar/noun/.
    Displays details for a specific part of speech.
    """
    # pos_data = thuddar.get_part_of_speech_data(pos_slug)
    pos_data = Thuddar().read_pos(pos_slug)
    
    # If no data is returned, the file doesn't exist. Raise a 404 error.
    # if not pos_data:
    #     raise Http404("Part of speech not found")

    # Prepare keywords like in the original JS
    keywords = []
    if 'root' in pos_data and 'name' in pos_data['root']:
        keywords.append(pos_data['root']['name'])
    if 'info' in pos_data and 'name' in pos_data['info']:
        keywords.append(pos_data['info']['name'])
    if 'kind' in pos_data:
        for item in pos_data['kind']:
            if 'root' in item and 'name' in item['root']:
                keywords.append(item['root']['name'])

    context = {
        'title': pos_data.get('root', {}).get('name', 'Detail'),
        'description': pos_data.get('root', {}).get('desc', '').replace("'", ""),
        'keywords': ", ".join(keywords),
        'grammar': pos_data,
    }
    return render(request, 'core/grammar-detail.html', context)
