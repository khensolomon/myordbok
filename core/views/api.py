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
from ..assist.search.engine import DictionarySearch

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

class SearchEngineAPIView(APIView):
    """
    API endpoint for the dictionary search.
    Accepts a 'q' query parameter.
    e.g., /api/search/?q=love
    e.g., /api/search/?q=knowledge is power~power
    """

    def get(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        query = request.query_params.get('q', None)
        
        if query is None:
            return Response(
                {"error": "Query parameter 'q' is required."}, 
                status=status.HTTP_400_BAD_REQUEST
            )
 
        search_engine = DictionarySearch(raw_query=query)
        response_data = search_engine.execute()

        
        return Response(response_data)
