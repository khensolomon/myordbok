"""
models.other
"""
from django.db import models
from django.contrib.auth.models import User

# Create your models here.
class Note(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    show_in_menu = models.BooleanField(default=False) # Add this line

    def __str__(self):
        return self.title

class Post(models.Model):
    title = models.CharField(max_length=200)
    content = models.TextField()
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)
    # Add this new field
    is_published = models.BooleanField(default=False)
    
    def __str__(self):
        return self.title

class Comment(models.Model):
    # This is the absolute relationship. Every comment MUST be linked to one Post.
    post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
    author = models.ForeignKey(User, on_delete=models.CASCADE)
    text = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f'Comment by {self.author.username} on "{self.post.title}"'

# # --- (You can add the TypeWord model if it exists or you want to create it) ---
# # class TypeWord(models.Model):
# #     name = models.CharField(max_length=100)
# #     # ... other fields
# #
# #     def __str__(self):
# #         return self.name

# class ListWord(models.Model):
#     # Django automatically handles the primary key, but we define it
#     # explicitly here to exactly match your table structure.
#     id = models.AutoField(primary_key=True, help_text="Word ID")

#     # This corresponds to your `word` VARCHAR(250) column.
#     # We use blank=True and null=True to allow empty values.
#     word = models.CharField(max_length=250, blank=True, null=True, help_text="Word English")

#     # --- Option 1: Direct Translation (if you don't have a TypeWord model) ---
#     # This directly matches your `derived` INT column.
#     derived = models.IntegerField(default=0, blank=True, null=True, help_text="type_word.id")

#     # --- Option 2: The "Django Way" (Recommended if you have a TypeWord model) ---
#     # If you had a model for your `type_word` table, you would use a ForeignKey.
#     # This provides much more power and data integrity.
#     # Uncomment this and comment out Option 1 if you create a TypeWord model.
#     #
#     # derived_fk = models.ForeignKey(
#     #     TypeWord,
#     #     on_delete=models.SET_NULL, # Or another on_delete rule
#     #     db_column='derived',       # Tells Django to use the existing 'derived' column
#     #     blank=True,
#     #     null=True
#     # )

#     class Meta:
#         # This is the most important line. It tells Django to NEVER
#         # modify this table's structure (no migrations will affect it).
#         managed = False

#         # This explicitly tells Django which database table to use.
#         db_table = 'list_word'

#     def __str__(self):
#         return self.word