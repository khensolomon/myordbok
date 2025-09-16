"""
version: 2025.09.16.3

Recent Updates:
- Added a `status` column to track if the last search for a word was successful.
"""
from django.db import models

class LogSearch(models.Model):
    """
    Logs user search queries to power features like spelling suggestions,
    word of the day, and search analytics.
    """
    word = models.CharField(
        max_length=255,
        db_index=True,
        help_text="The exact word or phrase searched by the user."
    )
    equivalent = models.CharField(
        max_length=255,
        blank=True,
        null=True,
        help_text="The corrected or canonical equivalent for the searched word."
    )
    lang = models.CharField(
        max_length=10,
        db_index=True,
        help_text="The language ID of the search (e.g., 'en', 'no')."
    )
    count = models.PositiveIntegerField(
        default=1,
        help_text="How many times this word has been searched."
    )
    status = models.IntegerField(
        default=0,
        help_text="The status of the last search (0=Not Found, 1=Found)."
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        help_text="Timestamp of the last time this word was searched."
    )

    class Meta:
        managed = False
        db_table = 'log_search'
        # A unique constraint ensures we don't have duplicate rows for the same word in the same language.
        unique_together = ('word', 'lang')
        ordering = ['-count'] # By default, order results by most popular.

    def __str__(self):
        return f"{self.word} ({self.lang}) - Status: {self.status}, Count: {self.count}"

