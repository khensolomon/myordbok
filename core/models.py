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

# Model for your existing 'type_word' table
class TypeWord(models.Model):
    """Represents a type of word (e.g., noun, verb)."""
    word_type = models.IntegerField(primary_key=True, db_column='word_type')
    name = models.CharField(max_length=50, blank=True, null=True, db_column='name')
    shortname = models.CharField(max_length=5, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'type_word'

    def __str__(self):
        return f"{self.name} ({self.word_type})"

class TypeDerived(models.Model):
    """Represents a type of derivation (e.g., past tense, plural)."""
    derived_type = models.AutoField(primary_key=True)
    word_type = models.ForeignKey(TypeWord, on_delete=models.CASCADE, db_column='word_type')
    derivation = models.CharField(max_length=20, blank=True, null=True)

    class Meta:
        managed = False
        db_table = 'type_derived'

    def __str__(self):
        return self.derivation
    
class ListWord(models.Model):
    """Represents a word entry in the dictionary."""
    word = models.CharField(max_length=250, blank=True, null=True, db_index=True)
    equivalent = models.CharField(max_length=250, blank=True, null=True)
    derived = models.ForeignKey(TypeWord, on_delete=models.CASCADE, db_column='derived')
    
    thesaurus = models.ManyToManyField('self', through='MapThesaurus', symmetrical=False, related_name='related_thesaurus_entries')
    similar = models.ManyToManyField('self', through='MapSimilar', symmetrical=False, related_name='related_similar_entries')
    antonyms = models.ManyToManyField('self', through='MapAntonym', symmetrical=False, related_name='related_antonym_entries')

    class Meta:
        managed = False
        db_table = 'list_word'

    def __str__(self):
        return self.word
    
class ListSense(models.Model):
    """Represents a specific sense or definition of a word."""
    word = models.CharField(max_length=250, blank=True, null=True, db_index=True)
    wrte = models.ForeignKey(TypeWord, on_delete=models.CASCADE, db_column='wrte')
    sense = models.TextField(blank=True, null=True)
    exam = models.TextField(blank=True, null=True)
    wseq = models.IntegerField(default=0)
    wrkd = models.IntegerField(default=0, help_text="Corresponds to type_sense.id in the original schema")
    wrid = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wrid')
    dated = models.DateTimeField(auto_now_add=True)

    class Meta:
        managed = False
        db_table = 'list_sense'
        ordering = ['wseq']

    def __str__(self):
        return f'{self.word} ({self.id})'

class MapDerived(models.Model):
    """Maps a base word to its derived form (e.g., love -> loved)."""
    base_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, related_name='base_word_mappings')
    derived_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, related_name='derived_word_mappings')
    dete = models.ForeignKey(TypeDerived, on_delete=models.CASCADE, db_column='dete')
    wrig = models.IntegerField(default=0, help_text="Irregular flag")
    wrte = models.ForeignKey(TypeWord, on_delete=models.CASCADE, db_column='wrte')

    class Meta:
        managed = False
        db_table = 'map_derived'

# Through model for Thesaurus ManyToMany relationship
class MapThesaurus(models.Model):
    from_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wrid', related_name='from_thesaurus')
    to_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wlid', related_name='to_thesaurus')

    class Meta:
        managed = False
        db_table = 'map_thesaurus'
        unique_together = ('from_word', 'to_word')

# Through model for Similar ManyToMany relationship
class MapSimilar(models.Model):
    from_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wrid', related_name='from_similar')
    to_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wlid', related_name='to_similar')

    class Meta:
        managed = False
        db_table = 'map_similar'
        unique_together = ('from_word', 'to_word')

# Through model for Antonym ManyToMany relationship
class MapAntonym(models.Model):
    from_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wrid', related_name='from_antonym')
    to_word = models.ForeignKey(ListWord, on_delete=models.CASCADE, db_column='wlid', related_name='to_antonym')

    class Meta:
        managed = False
        db_table = 'map_antonym'
        unique_together = ('from_word', 'to_word')