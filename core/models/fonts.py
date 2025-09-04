"""
models.fonts
"""
from django.db import models

class FontLog(models.Model):
    """
    Maps to the `log_fonts` table to store font statistics and restrictions.
    """
    class FontType(models.IntegerChoices):
        PRIMARY = 0, 'Primary'
        SECONDARY = 1, 'Secondary'
        EXTERNAL = 2, 'External'

    # The SQL `id` is Django's default AutoField.
    file = models.CharField(
        max_length=50,
        unique=True,
        help_text="The font's filename (e.g., 'Roboto.ttf')"
    )
    types = models.IntegerField(
        choices=FontType.choices,
        default=FontType.SECONDARY,
        help_text="0: primary, 1: secondary, 2: external"
    )
    view = models.BigIntegerField(default=0, help_text="View count")
    download = models.BigIntegerField(default=0, help_text="Download count")
    restricted = models.BooleanField(default=False, help_text="If true, download is disabled")
    dated = models.DateTimeField(auto_now=True, help_text="Timestamp of the last interaction")

    def __str__(self):
        return self.file

    class Meta:
        db_table = 'log_fonts' # Explicitly set the table name to match your SQL
        ordering = ['-view', '-download']
        indexes = [
            models.Index(fields=['file']),
        ]

