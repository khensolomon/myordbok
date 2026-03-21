"""
admin.fonts
"""
from django.contrib import admin
from ..models import ListFont

# Register your models here.
# admin.site.register(ListFont)

@admin.register(ListFont)
class ListFontAdmin(admin.ModelAdmin):
    # This is the line that sets the default order.
    # It will sort alphabetically by the 'word' field (A-Z).
    ordering = ('id',)
    
    # It's also good practice to add list_display and search_fields
    list_display = ('id', 'file', 'types', 'download', 'name', 'version', 'family', 'last_scanned', 'status')
    search_fields = ('name',)

