"""
admin.dictionary
"""
from django.contrib import admin
from ..models import ListWord, TypeWord

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

