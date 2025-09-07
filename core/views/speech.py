"""
speech.py
"""
import urllib.request
from django.conf import settings
from django.http import  HttpRequest, HttpResponse, StreamingHttpResponse

def home(request: HttpRequest) -> HttpResponse:
    word = request.GET.get('q') 
    lang = request.GET.get('l','en')
    url = settings.SPEECH_URL.replace('$q', word).replace('$l', lang)

    remote = urllib.request.urlopen(url)
        
    response = StreamingHttpResponse(
        remote,
        content_type=remote.info().get_content_type()
        # content_type=r.headers.get("Content-Type", "application/octet-stream")
    )
    # # optional: set filename if it's a download
    # response["Content-Disposition"] = 'inline; filename="tutorial.pdf"'
    return response