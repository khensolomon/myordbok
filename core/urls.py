"""
urls.py

This is used for reversing URLs in templates, e.g., {% url 'grammar:grammar-detail' ... %}
"""
from django.urls import path
from .views import (
  general, docs, 
  definition, dictionary, grammar, fonts,
  api,
  other
)

# app_name = 'MyOrdbok'
urlpatterns = [
    path('', general.home, name='home'),
    path('about', general.about, name='about'),

    path('grammar', grammar.home, name='grammar-home'),
    path('grammar/<slug:pos_slug>', grammar.detail, name='grammar-detail'),

    # Main page for listing all fonts
    path('myanmar-fonts', fonts.font_viewer, name='font-home'),

    path('myanmar-fonts/', fonts.font_viewer, name='font-home'),
    path('myanmar-fonts/<str:font_type>/', fonts.font_viewer, name='font-detail'),
    path('myanmar-fonts/download/<str:font_type>/', fonts.download_font, name='font-download'),
    path('myanmar-fonts/scan/<str:font_type>/', fonts.scan_fonts, name='font-scan'),


    path('dictionary', dictionary.home, name='dictionary-home'),
    path('dictionary/<str:lang_name>', dictionary.detail, name='dictionary-detail'),

    path('definition', definition.home, name='definition'),

    path('privacy', docs.privacy_policy, name='privacy-policy'),
    path('terms', docs.terms_of_service, name='terms-of-service'),
    path('cookie-policy', docs.cookie_policy, name='cookie-policy'),
    
    # Add the URLs for our notes
    path('notes', other.note_list, name='note_list'),
    path('notes/<int:pk>', other.note_detail, name='note_detail'),

    # ForeignKey Relationship Demo
    path('posts/', other.post_list, name='post_list'),
    path('posts/<int:pk>', other.post_detail, name='post_detail'),

    path('api/words', other.ListWordAPIView.as_view(), name='word-api-list'),
    path('api/search', other.DictionarySearchView.as_view(), name='api_search'),
    path('api/oem/word/suggest', api.OEMWordSuggestAPIView.as_view(), name='oem_word_suggest'),
]