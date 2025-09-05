"""
middleware.py
"""
from typing import Callable
from django.http import (
    HttpRequest, HttpResponse
)
import htmlmin
from django.conf import settings

from .data import DICTIONARIES

class OrdIdCookieMiddleware:
    """
    This class-based middleware processes the 'solId' language cookie on every
    request. It's a more organized way to handle logic that needs to run once
    at startup versus logic that runs for every request.

    - The __init__ method runs only once when the server starts. It prepares
      the necessary data (valid IDs, a lookup map, and the default object)
      for efficient lookups.
      
    - The __call__ method runs for every single request. It validates the cookie
      and attaches both the `solId` and the full `language` object to the request.
    """
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response
        self._valid_lang_ids = set()
        self._lang_map = {}  # Map from lang 'id' to the full language object
        self._default_lang_id = 'en'
        # self._default_lang_obj = None
        self._default_lang_obj = 'English'

        # This setup logic runs only ONCE during server startup.
        for dictionary_group in DICTIONARIES:
            for lang in dictionary_group['lang']:
                self._valid_lang_ids.add(lang['id'])
                self._lang_map[lang['id']] = lang  # Populate the lookup map
                if lang.get('default'):
                    self._default_lang_id = lang['id']
        
        # Store the default language object for easy access
        self._default_lang_obj = self._lang_map.get(self._default_lang_id)

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # This validation logic runs for EVERY request.
        sol_id_from_cookie = request.COOKIES.get("solId")
        
        if sol_id_from_cookie in self._valid_lang_ids:
            validated_id = sol_id_from_cookie
        else:
            validated_id = self._default_lang_id
        
        # Look up the full language object using our pre-built map.
        language_object = self._lang_map.get(validated_id, self._default_lang_obj)

        # Attach both the ID and the full object to the request.
        # This provides maximum flexibility in views.
        request.solId = validated_id
        request.solInfo = language_object

        response = self.get_response(request)
        return response


class HtmlMinifyMiddleware:
    """
    This middleware minifies the HTML response in production environments.

    It checks if the DEBUG setting is False and if the response content type
    is 'text/html'. If both conditions are met, it uses the `htmlmin` library
    to remove whitespace, comments, and other unnecessary characters.
    """
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # First, get the response from the view
        response = self.get_response(request)

        # We only want to minify valid HTML responses in a production setting.
        # We check for DEBUG=False and the 'text/html' content type.
        # We also avoid minifying streaming responses as they are processed in chunks.
        if (
            not settings.DEBUG 
            and 'text/html' in response.get('Content-Type', '') 
            and not getattr(response, 'streaming', False)
            ):
            try:
                # Decode the content, minify it, and then re-encode it.
                # The keep_comments=False is aggressive and gives best performance.
                minified_content = htmlmin.minify(
                    response.content.decode('utf-8'),
                    remove_comments=True,
                    remove_empty_space=True,
                    remove_all_empty_space=True,
                    reduce_empty_attributes=True
                )
                response.content = minified_content.encode('utf-8')
            except Exception:
                # If minification fails for any reason, we'll just return
                # the original response to avoid breaking the site.
                pass

        return response
