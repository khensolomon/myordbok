"""
models.ord
"""
from django.db import models

class ORDEN(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    show_in_menu = models.BooleanField(default=False) # Add this line

    def __str__(self):
        return self.title


