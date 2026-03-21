"""
context_processors.py
"""
from django.http import (
    HttpRequest, HttpResponse
)
import config
from django.conf import settings
from django.urls import reverse, NoReverseMatch
import copy
# from .models import Note

# def main_menu(request: HttpRequest):
#     # Query the database for notes that should be in the menu
#     menu_notes = Note.objects.filter(show_in_menu=True).order_by('title')

#     # Return a dictionary. The key will be the variable name in the template.
#     return {
#         'main_menu_notes': menu_notes
#     }

def base_href(request: HttpRequest) -> HttpResponse:
    return {
        "base_href": getattr(settings, "BASE_HREF", "/")
    }

# It's good practice to keep the navigation structure separate,
# but for simplicity, we can define it here.
NAV_PAGES = [
    {'text': 'Home', 'url_name': 'home'},
    {'text': 'About', 'url_name': 'about'},
    {'text': 'Grammar', 'url_name': 'grammar-home'},
    {'text': 'Fonts', 'url_name': 'fonts-home'},
]
# MENU_PAGES, MENU_TERMS

NAV_TERMS = [
    {'text': 'Privacy Policy', 'url_name': 'privacy-policy'},
    {'text': 'Terms', 'url_name': 'terms-of-service'},
    {'text': 'Cookie Policy', 'url_name': 'cookie-policy'},
]


def _navigation_builder(request: HttpRequest, ls):
    """
    A context processor to add navigation links to the context.

    This function processes the ls=NAV_PAGES list and adds an 'is_current'
    key to each dictionary. The key is True if the link's URL path is a
    prefix of the current page's URL path.
    """
    # Get the path of the current request.
    current_path = request.path

    # Create a deep copy of the links to avoid modifying the original list.
    nav_links_with_status = copy.deepcopy(ls)

    # Add the 'is_current' flag to each link.
    for link in nav_links_with_status:
        try:
            # Resolve the URL name into a path.
            link_path = reverse(link['url_name'])

            # The homepage ('/') needs to be an exact match.
            # Otherwise, every page would match as all paths start with '/'.
            if link_path == '/':
                is_active = (current_path == link_path)
            else:
                # For all other links, check if the current path starts with the link's path.
                # This makes '/abc' active when visiting '/abc/etc'.
                is_active = current_path.startswith(link_path)
            
            link['is_current'] = is_active

        except NoReverseMatch:
            # If a URL name can't be resolved, it can't be the current page.
            link['is_current'] = False
    
    return nav_links_with_status

def nav_pages_builder(request: HttpRequest):
    """
    A context processor to add navigation links to the context.

    This function processes the NAV_PAGES list and adds an 'is_current'
    key to each dictionary. The key is True if the link's URL path is a
    prefix of the current page's URL path.
    """
    return {
        'nav_pages': _navigation_builder(request,NAV_PAGES)
    }

def nav_terms_builder(request: HttpRequest):
    return {
        'nav_terms': _navigation_builder(request,NAV_TERMS)
    }

def cookies_read(request: HttpRequest):
    return {
        "themeMode": request.COOKIES.get("theme", "auto"),
        # "solId": request.COOKIES.get("solId", "en")
        "sol": request.sol,
    }

def app_info(request: HttpRequest):
    return {
        "appName": config.name,
        "appVersion": config.version,
    }