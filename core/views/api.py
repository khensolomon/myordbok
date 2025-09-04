"""
other.py
"""
from django.http import (
    HttpRequest, HttpResponse
)
from rest_framework import (
     status
)
from rest_framework.views import APIView
from rest_framework.response import Response
from ..models import (
    ListSense
)

class OEMWordSuggestAPIView(APIView):
    """
    Provides autocomplete suggestions from the ListSense model.

    This view handles a GET request with a query parameter 'q'.
    It performs a case-insensitive 'starts with' search on the 'word' field
    and returns a flat, distinct list of matching words, limited to 6 results.
    
    If 'q' is not provided or is empty, it returns an empty list.
    """
    def get(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
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
    
