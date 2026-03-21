"""
models.other
"""
from django.db import models
from django.contrib.auth.models import User

# Create your models here.
# class Note(models.Model):
#     title = models.CharField(max_length=200)
#     content = models.TextField()
#     created_at = models.DateTimeField(auto_now_add=True)
#     updated_at = models.DateTimeField(auto_now=True)
#     show_in_menu = models.BooleanField(default=False) # Add this line

#     def __str__(self):
#         return self.title

# class Post(models.Model):
#     title = models.CharField(max_length=200)
#     content = models.TextField()
#     author = models.ForeignKey(User, on_delete=models.CASCADE)
#     created_at = models.DateTimeField(auto_now_add=True)
#     # Add this new field
#     is_published = models.BooleanField(default=False)
    
#     def __str__(self):
#         return self.title

# class Comment(models.Model):
#     # This is the absolute relationship. Every comment MUST be linked to one Post.
#     post = models.ForeignKey(Post, on_delete=models.CASCADE, related_name='comments')
#     author = models.ForeignKey(User, on_delete=models.CASCADE)
#     text = models.TextField()
#     created_at = models.DateTimeField(auto_now_add=True)

#     def __str__(self):
#         return f'Comment by {self.author.username} on "{self.post.title}"'

# # --- (You can add the TypeWord model if it exists or you want to create it) ---
# # class TypeWord(models.Model):
# #     name = models.CharField(max_length=100)
# #     # ... other fields
# #
# #     def __str__(self):
# #         return self.name
