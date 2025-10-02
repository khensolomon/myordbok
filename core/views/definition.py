"""
definition.py
"""
import config
from django.http import (
    HttpRequest, HttpResponse
)
from django.shortcuts import (
    render
)

from ..assist.search.engine import DictionarySearch

def home(request: HttpRequest) -> HttpResponse:
    # return render(request, 'core/definition.html', {'title': 'Definition'})
    # query = request.GET.get('q', None).strip()
    query = request.GET.get('q', None)
    lang = request.GET.get('l', None)
    # query = request.query_params.get('q', None)
    # lang = request.query_params.get('l', None)

    # def get(self, request: HttpRequest, *args, **kwargs) -> HttpResponse:
    
    # if query is None:
    #     return Response(
    #         {"error": "Query parameter 'q' is required."}, 
    #         status=status.HTTP_400_BAD_REQUEST
    #     )

    search_engine = DictionarySearch(raw_query=query, app_name=config.name)
    # response_data = search_engine.execute(lang or request.sol['id'])
    context = search_engine.execute(lang or request.sol['id'])
    context['pageClass'] ="definition"

    return render(request, 'core/definition/main.html', context)
