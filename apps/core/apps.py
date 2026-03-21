"""
App configuration for the 'core' app.
"""
from django.apps import AppConfig

class CoreConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core'

    def ready(self):
        """
        This method is called when the Django application is ready.
        We import our signals here to ensure they are connected.
        """
        # Implicitly connect signal handlers decorated with @receiver.
        from . import signals
