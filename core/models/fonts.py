"""
models.fonts
"""
from django.db import models

class FontType(models.IntegerChoices):
    PRIMARY = 0, 'primary'
    SECONDARY = 1, 'secondary'
    EXTERNAL = 2, 'external'

class FontStatus(models.IntegerChoices):
    ACTIVE = 0, 'Active'
    RESTRICTED = 1, 'Restricted'
    DISABLED = 2, 'Disabled'
    MISSING = 3, 'Missing'

class ListFont(models.Model):
    file = models.CharField(
        max_length=100, 
        unique=True,
        help_text="The font's filename (e.g., 'Roboto.ttf')"
    )
    types = models.IntegerField(
        default=FontType.PRIMARY, 
        choices=FontType.choices,
        help_text="The category of the font."
    )
    view = models.BigIntegerField(default=0, help_text="Count of views.")
    download = models.BigIntegerField(default=0, help_text="Count of downloads.")
    
    status = models.IntegerField(
        default=FontStatus.ACTIVE,
        choices=FontStatus.choices,
        help_text="The current status of the font."
    )
    
    name = models.CharField(max_length=100, blank=True, null=True)
    version = models.CharField(max_length=100, blank=True, null=True)
    family = models.CharField(max_length=100, blank=True, null=True)
    last_scanned = models.DateTimeField(null=True, blank=True)

    class Meta:
        managed = False
        # The table name is now dynamically set to <app_name>_fonts
        db_table = 'list_font'
        # --- END OF EDIT ---

    def __str__(self):
        return self.file


