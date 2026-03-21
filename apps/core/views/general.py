"""
general.py
"""

from django.http import  HttpRequest, HttpResponse
from django.shortcuts import (
    render
)
from config import data

def home(request: HttpRequest) -> HttpResponse:
    context = {
		"title": "online Myanmar dictionary",
		"keywords": "Myanmar, dictionary, grammar, font, definition, Burmese, online",
		"description": "A comprehensive online Myanmar dictionary, grammar, and fonts at MyOrdbok",
		"pageClass": "home"
    }
    return render(request, 'core/home.html', context)

def about(request: HttpRequest) -> HttpResponse:
    context = {
        'title': 'About',
        "keywords": "Myanmar dictionary, Burmesisk ordbok, Myanmar definition, Burmese, norsk ordbok, burmissk",
		"description": "One of the most popular online Myanmar dictionary",
        'dictionaries': data.DICTIONARIES,
        "locale_total":1,
        "dictionaries_total":24,
        "visits":{
            "created": "1581586385",
            "user": "24248",
            "request": "889993854163231",
            "by": "11831",
            "total": "1474293",
            "fresh": "11828"
        }
    }
    return render(request, 'core/about.html', context)


