"""
admin.py
"""
from django.contrib import admin
# from .models import Note # Import the Note model
from .models import (
    Note, Post, Comment,
    ListWord, TypeWord, ListFont  # Make sure to import your new models
)

# Register your models here.
admin.site.register(ListFont)
admin.site.register(Note)
# admin.site.register(ListWord)
# admin.site.register(TypeWord)
# admin.site.register(Post)
# admin.site.register(Comment)


@admin.register(TypeWord)
class TypeWordAdmin(admin.ModelAdmin):

    ordering = ('word_type',)
    
    # It's also good practice to add list_display and search_fields
    list_display = ('word_type', 'name', 'shortname')
    # search_fields = ('name','shortname')


@admin.register(ListWord)
class ListWordAdmin(admin.ModelAdmin):
    # This is the line that sets the default order.
    # It will sort alphabetically by the 'word' field (A-Z).
    ordering = ('id',)
    
    # It's also good practice to add list_display and search_fields
    list_display = ('id', 'word', 'equivalent', 'derived')
    search_fields = ('word',)

# We create a custom admin class for Post to make it searchable
@admin.register(Post)
class PostAdmin(admin.ModelAdmin):
    # This tells the autocomplete widget to search in the 'title' and 'content' fields
    search_fields = ('title', 'content')
    list_display = ('title', 'author', 'created_at', 'is_published') # Good to show more info
    list_filter = ('created_at', 'author', 'is_published') # Add filters for convenience
    list_per_page = 25 # Add this line to enable pagination

    # --- Define the custom actions here ---
    def make_published(self, request, queryset):
        queryset.update(is_published=True)
    make_published.short_description = "Mark selected posts as published"

    def make_unpublished(self, request, queryset):
        queryset.update(is_published=False)
    make_unpublished.short_description = "Mark selected posts as unpublished"

    # --- Register the actions ---
    actions = ['make_published', 'make_unpublished']
    
# We create a custom admin class for Comment
@admin.register(Comment)
class CommentAdmin(admin.ModelAdmin):
    # This is the magic line!
    # It tells the admin to use the raw_id_fields widget for the 'post' field.
    # raw_id_fields = ('post',)
    # It tells the admin to use the autocomplete widget for the 'post' field.
    autocomplete_fields = ('post',)
