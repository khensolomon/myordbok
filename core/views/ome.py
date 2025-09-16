"""
oem.py
"""
from django.http import (
    HttpRequest, HttpResponse, JsonResponse
)
from rest_framework import (
     status
)
from rest_framework.views import APIView
from rest_framework.response import Response
from ..models import (
    OmeWord
)
from ..assist.ome import (
    MedService
)
med_service = MedService()

class OMEWordSuggestAPIView(APIView):
    def get(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
        # Get the search query 'q' from the request parameters.
        query = request.query_params.get('q', '').strip()

        # If the query is empty, return an empty list immediately.
        if not query:
            return Response([], status=status.HTTP_200_OK)

        # Filter the OemSense objects where the 'word' starts with the query.
        # - 'word__istartswith' ensures a case-insensitive search.
        # - '.order_by('word').distinct()' prevents duplicate words in the result.
        # - '.values_list('word', flat=True)' creates the desired flat list of strings.
        # - '[:6]' limits the query to the first 6 results for performance.
        words = OmeWord.objects.filter(
            word__istartswith=query
        ).order_by('word').distinct().values_list('word', flat=True)[:6]

        # Return the list of words as a JSON response.
        return Response(list(words), status=status.HTTP_200_OK)
    
def word_suggestion(request):
    """ API view for word suggestions. """
    if request.method == 'GET':
        results = med_service.word_suggestion(request.GET)
        return JsonResponse(results, safe=False)
    return JsonResponse({'error': 'Invalid request method.'}, status=405)

def word_definition(request):
    """ API view to get the full details for a specific word. """
    if request.method == 'GET':
        word_query = request.GET.get('q', '').strip()
        if not word_query:
            return JsonResponse({'error': 'A query parameter "q" is required.'}, status=400)
        
        data = med_service.word_definition(word_query)
        
        if data is None:
            return JsonResponse({'error': f'Word "{word_query}" not found.'}, status=404)
            
        return JsonResponse(data)
    
    return JsonResponse({'error': 'Invalid request method.'}, status=405)