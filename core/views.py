# from django.shortcuts import render
# from .models import Note # Import the Note model

from rest_framework import (
    generics, status, pagination, filters
)
from rest_framework.views import APIView
from rest_framework.response import Response

# from rest_framework import generics, pagination, filters, views, response, status # Import new modules
from django.shortcuts import (
    render, get_object_or_404
)
from django.core.paginator import (
    Paginator
)
from .models import (
    Note, Post,
    ListWord,
    ListSense
)
from .serializers import ListWordSerializer
from .search_engine import DictionarySearch
from .data import DICTIONARIES
from .thuddar import Thuddar

# from django.http import HttpResponse
# def home(request):
#     return HttpResponse("<h1>Hello, Django World!</h1>")

def home(request):

    context = {
        'title': 'Hello, Django World!'
    }
    return render(request, 'core/home.html', context)

def about(request):


    context = {
        'title': 'About',
        "keywords": "Myanmar dictionary, Burmesisk ordbok, Myanmar definition, Burmese, norsk ordbok, burmissk",
		"description": "One of the most popular online Myanmar dictionary",
        'dictionaries': DICTIONARIES,
        "locale_total":1,
        "dictionaries_total":24,
        "visits":{
            "created": "1581586385",
            "user": "11828",
            "request": "641909",
            "by": "11831",
            "total": "1010473",
            "fresh": "11828"
        }
    }
    return render(request, 'core/about.html', context)

# def grammar(request):
#     return render(request, 'core/grammar.html', {'title': 'Grammar'})

def grammar_index(request):
    """
    View for the main /grammar/ page.
    Displays a list of all parts of speech from snap.json.
    """
    # snap_data = thuddar.get_snap_data()
    # thuddar = Thuddar()
    snap_data = Thuddar().read_direct_include('snap')

    
    # The context is what gets passed to the template
    context = {
        'title': snap_data.get('context', {}).get('name', 'Grammar'),
        'description': snap_data.get('context', {}).get('desc', ''),
        'grammar': snap_data,
    }
    return render(request, 'core/grammar.html', context)

def part_of_speech_detail(request, pos_slug):
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
    return render(request, 'core/grammar-pos.html', context)


def fonts(request):
    return render(request, 'core/fonts.html', {'title': 'Fonts'})

def dictionary(request):
    """
    This view passes the language data to the template.
    """
    # 2. You can now use the DICTIONARIES variable in your Python code.
    # For example, let's find the default language.
    default_lang = None
    for group in DICTIONARIES:
        for lang in group['lang']:
            if lang.get('default'):
                default_lang = lang
                break
        if default_lang:
            break
    
    print(f"The default language is: {default_lang['name']}")

    return render(request, 'core/dictionary.html', {'title': 'Dictionary', 'dictionaries': DICTIONARIES})

def definition(request):
    return render(request, 'core/definition.html', {'title': 'Definition'})


def privacy_policy(request):
    context = {
        'title': 'Privacy Policy',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/privacy.html', context)

def terms_of_service(request):
    context = {
        'title': 'Terms',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/terms.html', context)

def cookie_policy(request):
    context = {
        'title': 'Cookie Policy',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/cookie-policy.html', context)

def note_list(request):
    notes = Note.objects.all().order_by('-created_at') # Get all notes, newest first
    context = {
        'notes': notes,
    }
    return render(request, 'core/note_list.html', context)

def note_detail(request, pk):
    note = Note.objects.get(pk=pk) # Get the specific note by its primary key (pk)
    context = {
        'note': note,
    }
    return render(request, 'core/note_detail.html', context)

def post_list(request):
    # posts = Post.objects.all().order_by('-created_at')
    # context = {
    #     'posts': posts
    # }
    # return render(request, 'core/post_list.html', context)
    all_posts = Post.objects.all().order_by('-created_at')
    
    # Set up the Paginator
    paginator = Paginator(all_posts, 2) # Show 10 posts per page
    page_number = request.GET.get('page') # Get the current page number from the URL
    page_obj = paginator.get_page(page_number) # Get the Page object for the requested page

    context = {
        'page_obj': page_obj # Pass the Page object to the template
    }
    return render(request, 'core/post_list.html', context)

def post_detail(request, pk):
    post = get_object_or_404(Post, pk=pk)
    # The 'post.comments.all()' comes from the related_name we set in the model
    context = {
        'post': post,
        'comments': post.comments.all().order_by('created_at')
    }
    return render(request, 'core/post_detail.html', context)


class OEMWordSuggestAPIView(APIView):
    """
    Provides autocomplete suggestions from the ListSense model.

    This view handles a GET request with a query parameter 'q'.
    It performs a case-insensitive 'starts with' search on the 'word' field
    and returns a flat, distinct list of matching words, limited to 6 results.
    
    If 'q' is not provided or is empty, it returns an empty list.
    """
    def get(self, request, *args, **kwargs):
        # Get the search query 'q' from the request parameters.
        query = request.query_params.get('q', '').strip()

        # If the query is empty, return an empty list immediately.
        if not query:
            return Response([], status=status.HTTP_200_OK)

        # Filter the ListSense objects where the 'word' starts with the query.
        # - 'word__istartswith' ensures a case-insensitive search.
        # - '.order_by('word').distinct()' prevents duplicate words in the result.
        # - '.values_list('word', flat=True)' creates the desired flat list of strings.
        # - '[:6]' limits the query to the first 6 results for performance.
        words = ListSense.objects.filter(
            word__istartswith=query
        ).order_by('word').distinct().values_list('word', flat=True)[:6]

        # Return the list of words as a JSON response.
        return Response(list(words), status=status.HTTP_200_OK)
    
# 1. Create a custom pagination class (optional, but good practice)
class ListWordAPIPagination(pagination.PageNumberPagination):
    page_size = 100  # Number of results per page
    page_size_query_param = 'page_size' # Allows client to set page_size e.g. ?page_size=50
    max_page_size = 1000 # Maximum page size client can request
    # page_query_param = 'p' # Add this line to change "page" to "p"

# --- Create a custom search filter ---
class ListWordAPIFilter(filters.SearchFilter):
    # This is the line that changes the query parameter
    search_param = 'k'

# --- Update the API view to use the custom filter ---
class ListWordAPIView(generics.ListAPIView):
    """
    API view to search for words.
    Supports searching with ?k=keyword
    Supports pagination with ?page=number
    """
    queryset = ListWord.objects.all()
    serializer_class = ListWordSerializer
    
    # Use your new custom filter class
    filter_backends = [ListWordAPIFilter]
    pagination_class = ListWordAPIPagination
    
    search_fields = ['^word']

class DictionarySearchView(APIView):
    """
    API endpoint for the dictionary search.
    Accepts a 'q' query parameter.
    e.g., /api/search/?q=love
    e.g., /api/search/?q=knowledge is power~power
    """

    def get(self, request, *args, **kwargs):
        query = request.query_params.get('q', None)
        
        if query is None:
            return Response(
                {"error": "Query parameter 'q' is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
 
        search_engine = DictionarySearch(raw_query=query)
        response_data = search_engine.execute()

        
        return Response(response_data)




