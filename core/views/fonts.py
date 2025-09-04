import re
import logging
from django.shortcuts import render
from django.http import HttpResponse, FileResponse, Http404, HttpResponseForbidden
from ..assist.fonts import font_manager

from django.conf import settings

# Set up a logger for this file
log = logging.getLogger(__name__)

def _format_detail_meta(name_table: dict):
    """Faithfully recreates the metadata formatting from the original Node.js logic."""
    tpl = {0:"Copyright", 1:"Font Family", 2:"Font Subfamily", 4:"Full name", 5:"Version", 9:"Author", 10:"Description", 11:"URL", 13:"License"}
    response = {"info": [], "definition": [], "license": [], "url": [], "copyright": []}

    def get_tag(text):
        is_uppercase = re.match(r"^[^a-z]*$", text)
        return "h3" if is_uppercase and len(text.split()) <= 4 else "p"

    for key, context in name_table.items():
        i = int(key)
        context = context.strip()
        if not context: continue

        if re.match(r"^s?https?://", context):
            if not any(u['href'] == context for u in response["url"]):
                response["url"].append({"href": context, "text": context})
        elif 1 <= i < 6:
            response["info"].append({"tag": f"h{i}", "class": tpl.get(i, "").replace(" ", "-").lower(), "text": context})
        elif i == 0:
            for p in re.split(r'~?\r?\n~?', context):
                if p.strip(): response["copyright"].append({"tag": get_tag(p), "text": p.strip()})
        elif i == 10:
            for p in re.split(r'~?\r?\n~?', context):
                if p.strip(): response["definition"].append({"tag": get_tag(p), "text": p.strip()})
        elif i == 13:
            for p in re.split(r'~?\r?\n~?', context):
                if p.strip(): response["license"].append({"tag": get_tag(p), "text": p.strip()})
        elif i in tpl:
             response["info"].append({"tag": "p", "class": tpl.get(i, "").replace(" ", "-").lower(), "text": context})
    return response


def font_viewer(request, font_type=None):
    """Handles both list and detail views. Font name is passed as a query param."""
    font_name = request.GET.get('font', None)
    
    # log.info(f"--- Font Detail Request ---")
    # log.info(f"URL Parameter 'font_type': '{font_type}'")
    # log.info(f"Query Parameter 'font': '{font_name}'")
    # log.info(f"storage': '{settings.STORAGE_DIR}'")

    context = font_manager.get_font_context(font_type, font_name)
    
    # --- START OF FIX ---
    # The view is now responsible for formatting the data, breaking the circular import.
    if 'font_info' in context and context['font_info']:
        raw_info = context.pop('font_info') # Get raw data and remove it from context
        if 'name' in raw_info.get('tables', {}):
            formatted_meta = _format_detail_meta(raw_info['tables']['name'])
            context.update(formatted_meta) # Add the formatted data back to the context
    # --- END OF FIX ---
            
    return render(request, 'core/fonts.html', context)

def download_font(request, font_type):
    """Handles download request. Font name is passed as a query param."""
    font_name = request.GET.get('font', None)
    if not font_name:
        raise Http404("Font name not specified in the 'font' query parameter.")

    font_path = font_manager.get_font_for_download(font_type, font_name)

    if font_path:
        return FileResponse(open(font_path, 'rb'), as_attachment=True, filename=font_name)
    else:
        if not font_manager.get_font_path(font_type, font_name):
            raise Http404("Font file not found.")
        return HttpResponseForbidden("This font is restricted and cannot be downloaded.")

def scan_fonts(request, font_type):
    """Triggers a scan to sync the database with files on disk."""
    message = font_manager.scan_and_sync_database(font_type)
    return HttpResponse(message)

