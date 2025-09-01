# core/urls.py (new file)
from django.urls import path
from . import views

# This is used for reversing URLs in templates, e.g., {% url 'grammar:pos_detail' ... %}
# app_name = 'MyOrdbok'

urlpatterns = [
    path('', views.home, name='home'),
    path('about', views.about, name='about'),
    # path('grammar', views.grammar, name='grammar'),

        # Matches '/grammar/'
    path('grammar', views.grammar_index, name='grammar'),
    
    # Matches '/grammar/noun/', '/grammar/verb/', etc.
    # The <slug:pos_slug> part captures the text from the URL 
    # and passes it as the 'pos_slug' argument to the view.
    path('grammar/<slug:pos_slug>', views.part_of_speech_detail, name='pos_detail'),

    path('myanmar-fonts', views.fonts, name='fonts'),

    path('dictionary', views.dictionary, name='dictionary'),
    path('definition', views.definition, name='definition'),


    path('privacy', views.privacy_policy, name='privacy_policy'),
    path('terms', views.terms_of_service, name='terms_of_service'),
    path('cookie-policy', views.cookie_policy, name='cookie_policy'),
    
    # Add the URLs for our notes
    path('notes/', views.note_list, name='note_list'),
    path('notes/<int:pk>', views.note_detail, name='note_detail'),

    # ForeignKey Relationship Demo
    path('posts/', views.post_list, name='post_list'),
    path('posts/<int:pk>/', views.post_detail, name='post_detail'),

    path('api/words/', views.ListWordAPIView.as_view(), name='word-api-list'),

    # URL for the API endpoint (returns JSON)
    # path('api/search/', views.ApiSearchView.as_view(), name='api_search'),
    path('api/search/', views.DictionarySearchView.as_view(), name='api_search'),


    # /api/oem/word/suggest?q=iiuuu
    path('api/oem/word/suggest', views.OEMWordSuggestAPIView.as_view(), name='oem_word_suggest'),

    
    # URL for the user-facing search page (renders HTML)
    # path('definition/', views.TemplateSearchView.as_view(), name='template_search'),
    # path('definition/',  views.search_page_view, name='template_search'),
]