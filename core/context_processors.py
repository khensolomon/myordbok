# core/context_processors.py
from .models import Note

def main_menu(request):
    # Query the database for notes that should be in the menu
    menu_notes = Note.objects.filter(show_in_menu=True).order_by('title')

    # Return a dictionary. The key will be the variable name in the template.
    return {
        'main_menu_notes': menu_notes
    }


# It's good practice to keep the navigation structure separate,
# but for simplicity, we can define it here.
NAV_LINKS = [
    {'text': 'Home', 'url_name': 'home'},
    {'text': 'About', 'url_name': 'about'},
    {'text': 'Grammar', 'url_name': 'grammar'},
    {'text': 'Fonts', 'url_name': 'fonts'},
]

def navigation(request):
    """
    A context processor to add navigation links to the context.

    This function processes the NAV_LINKS list and adds an 'is_current'
    key to each dictionary. This key is True if the link's URL name
    matches the name of the currently resolved URL.
    """
    # Get the name of the currently resolved URL, if it exists.
    current_url_name = None
    if request.resolver_match:
        current_url_name = request.resolver_match.url_name

    # Create a deep copy of the links to avoid modifying the original list
    import copy
    nav_links_with_status = copy.deepcopy(NAV_LINKS)

    # Add the 'is_current' flag to each link
    for link in nav_links_with_status:
        link['is_current'] = (link['url_name'] == current_url_name)

    return {
        'nav_links': nav_links_with_status
    }

def cookies_read(request):
    return {
        "themeMode": request.COOKIES.get("theme", "auto"),
        "solId": request.COOKIES.get("solId", "en")
    }

def app_info(request):
    return {
        "appName": "MyOrdbok",
        "appVersion": "2.0.11",
    }