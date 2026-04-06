"""
middleware.py
"""
from typing import Callable
from django.http import (
    HttpRequest, HttpResponse
)
import minify_html
from django.conf import settings

from .data import DICTIONARIES, DictionaryItem

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
        language_object: DictionaryItem = self._lang_map.get(validated_id, self._default_lang_obj)

        # Attach both the ID and the full object to the request.
        # This provides maximum flexibility in views.
        request.solId = validated_id
        request.sol = language_object

        response = self.get_response(request)
        return response


class HtmlMinifyMiddleware:
    """
    This middleware minifies the HTML response in production environments.

    It uses the blazing-fast Rust-based `minify-html` library, which properly 
    understands and safely minifies inline CSS and JavaScript without breaking them.
    """
    def __init__(self, get_response: Callable[[HttpRequest], HttpResponse]) -> None:
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # First, get the response from the view
        response = self.get_response(request)

        # We only want to minify valid HTML responses in a production setting.
        # We check for DEBUG=False, the 'text/html' content type, 
        # ensure it's not streaming, and ensure there is actual content.
        if (
            not settings.DEBUG 
            and 'text/html' in response.get('Content-Type', '') 
            and not getattr(response, 'streaming', False)
            and response.content
        ):
            try:
                # Decode the original HTML content
                html_content = response.content.decode('utf-8')

                # Minify the HTML, including inline JS and CSS
                minified_content = minify_html.minify(
                    html_content,
                    minify_js=True,
                    minify_css=True,
                    keep_closing_tags=True,  # Safer if you use JS frameworks like Vue/React
                    do_not_minify_doctype=True,
                    ensure_spec_compliant_unquoted_attribute_values=True
                )
                
                # Re-encode the minified content
                response.content = minified_content.encode('utf-8')
                
                # CRITICAL: Update the Content-Length header if it exists. 
                # Since we removed bytes, the old length is now invalid.
                if 'Content-Length' in response:
                    response['Content-Length'] = str(len(response.content))
                    
            except Exception:
                # If minification fails for any reason (e.g., severe syntax errors),
                # we'll just return the original response to avoid breaking the site.
                pass

        return response