"""
general.py
"""
# import os
# import re
from django.http import  JsonResponse
# from django.conf import settings
# from ..models import Track

def home(request):
    return JsonResponse({"status": "success", "message": "online!"})

