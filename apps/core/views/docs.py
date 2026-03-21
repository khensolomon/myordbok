"""
docs.py
"""
from django.http import (
    HttpRequest, HttpResponse
)
from django.shortcuts import (
    render
)

def privacy_policy(request: HttpRequest) -> HttpResponse:
    context = {
        'title': 'Privacy Policy',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/privacy.html', context)

def terms_of_service(request: HttpRequest) -> HttpResponse:
    context = {
        'title': 'Terms',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/terms.html', context)

def cookie_policy(request: HttpRequest) -> HttpResponse:
    context = {
        'title': 'Cookie Policy',
        "appDomain": "myordbok.com",
    }
    return render(request, 'core/cookie-policy.html', context)
