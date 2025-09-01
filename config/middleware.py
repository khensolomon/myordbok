import htmlmin
from django.conf import settings

class HtmlMinifyMiddleware:
    """
    This middleware minifies the HTML response in production environments.

    It checks if the DEBUG setting is False and if the response content type
    is 'text/html'. If both conditions are met, it uses the `htmlmin` library
    to remove whitespace, comments, and other unnecessary characters.
    """
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        # First, get the response from the view
        response = self.get_response(request)

        # We only want to minify valid HTML responses in a production setting.
        # We check for DEBUG=False and the 'text/html' content type.
        # We also avoid minifying streaming responses as they are processed in chunks.
        if not settings.DEBUG and 'text/html' in response.get('Content-Type', '') and not getattr(response, 'streaming', False):
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
