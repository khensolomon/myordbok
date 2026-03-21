"""
other.py
"""
from django.http import (
    HttpRequest, HttpResponse
)
from rest_framework import (
    generics, status, pagination, filters
)
from rest_framework.views import APIView
from rest_framework.response import Response

from django.shortcuts import (
    render, get_object_or_404
)
from django.core.paginator import (
    Paginator
)
from ..models import (
    # Note, Post,
    OemWord
)
from ..serializers import ListWordSerializer

# def note_list(request: HttpRequest) -> HttpResponse:
#     notes = Note.objects.all().order_by('-created_at') # Get all notes, newest first
#     context = {
#         'notes': notes,
#     }
#     return render(request, 'core/note_list.html', context)

# def note_detail(request: HttpRequest, pk: int) -> HttpResponse:
#     note = Note.objects.get(pk=pk) # Get the specific note by its primary key (pk)
#     context = {
#         'note': note,
#     }
#     return render(request, 'core/note_detail.html', context)

# def post_list(request: HttpRequest) -> HttpResponse:
#     # posts = Post.objects.all().order_by('-created_at')
#     # context = {
#     #     'posts': posts
#     # }
#     # return render(request, 'core/post_list.html', context)
#     all_posts = Post.objects.all().order_by('-created_at')
    
#     # Set up the Paginator
#     paginator = Paginator(all_posts, 2) # Show 10 posts per page
#     page_number = request.GET.get('page') # Get the current page number from the URL
#     page_obj = paginator.get_page(page_number) # Get the Page object for the requested page

#     context = {
#         'page_obj': page_obj # Pass the Page object to the template
#     }
#     return render(request, 'core/post_list.html', context)

# def post_detail(request: HttpRequest, pk: int) -> HttpResponse:
#     post = get_object_or_404(Post, pk=pk)
#     # The 'post.comments.all()' comes from the related_name we set in the model
#     context = {
#         'post': post,
#         'comments': post.comments.all().order_by('created_at')
#     }
#     return render(request, 'core/post_detail.html', context)

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
    queryset = OemWord.objects.all()
    serializer_class = ListWordSerializer
    
    # Use your new custom filter class
    filter_backends = [ListWordAPIFilter]
    pagination_class = ListWordAPIPagination
    
    search_fields = ['^word']


