import config
from django.conf import settings

def app_info(request):
    """
    A Django Context Processor that injects global application variables 
    into EVERY template automatically.
    
    It reads from your Django settings.py file, with safe fallbacks 
    in case the variables haven't been defined yet.
    """
    return {
        # 'appName': getattr(settings, 'APP_NAME', 'Zaideih'),
        # 'appVersion': getattr(settings, 'APP_VERSION', '1.0.0'),
        # 'environment': getattr(settings, 'ENVIRONMENT', 'development'),
        "appName": config.name,
        "appVersion": config.version,        
    }