"""
definition.py
"""
# from django.shortcuts import render
# from .models import Note # Import the Note model
from django.http import (
    HttpRequest, HttpResponse
)
from django.shortcuts import (
    render
)

def home(request: HttpRequest) -> HttpResponse:
    return render(request, 'core/definition.html', {'title': 'Definition'})
