"""
version: 2025.09.18.1

This module contains Django signal receivers to handle automatic cache
invalidation. When a model instance is updated or deleted, these functions
will surgically remove the corresponding search result from the cache,
ensuring data consistency.
"""
from django.db.models.signals import post_save, post_delete
from django.dispatch import receiver
from django.core.cache import cache

# Assuming your models are in these locations. Adjust if necessary.
from .models.ome import OmeSense
from .models.oem import OemSense
from .models.ord_abstract_base import get_all_ord_models

@receiver([post_save, post_delete], sender=OemSense)
def invalidate_oem_cache(sender, instance, **kwargs):
    """
    Invalidates the cache for an English word when its sense is updated.
    """
    # This check safely handles both post_save and post_delete.
    # 'raw' will be True during loaddata, but won't exist for post_delete.
    if kwargs.get('raw'):
        return
    
    if hasattr(instance, 'word') and instance.word:
        word = instance.word.lower()
        cache_key = f"search:en:{word}"
        cache.delete(cache_key)
        print(f"Signal received: Invalidated OEM cache for '{word}' (key: {cache_key})")


@receiver([post_save, post_delete], sender=OmeSense)
def invalidate_ome_cache(sender, instance, **kwargs):
    """
    Invalidates the cache for a Myanmar word when its sense is updated.
    """
    # This check safely handles both post_save and post_delete.
    # 'raw' will be True during loaddata, but won't exist for post_delete.
    if kwargs.get('raw'):
        return
    
    if hasattr(instance, 'wrid') and hasattr(instance.wrid, 'word') and instance.wrid.word:
        word = instance.wrid.word.lower()
        cache_key = f"search:my:{word}"
        cache.delete(cache_key)
        print(f"Signal received: Invalidated OME cache for '{word}' (key: {cache_key})")


def invalidate_ord_cache(sender, instance, **kwargs):
    """
    A generic handler for all ORD models. Invalidates the cache for a
    source-language word when its translation is updated.
    """
    # This check safely handles both post_save and post_delete.
    # 'raw' will be True during loaddata, but won't exist for post_delete.
    if kwargs.get('raw'):
        return
    
    if hasattr(instance, 'word') and instance.word:
        # We need to figure out the language from the model's table name
        lang_id = sender._meta.db_table.replace('ord_', '').lower()
        word = instance.word.lower()
        cache_key = f"search:{lang_id}:{word}"
        cache.delete(cache_key)
        print(f"Signal received: Invalidated ORD cache for '{word}' (lang: {lang_id}, key: {cache_key})")


# Dynamically connect the signal to all ORD models
for ord_model in get_all_ord_models():
    post_save.connect(invalidate_ord_cache, sender=ord_model)
    post_delete.connect(invalidate_ord_cache, sender=ord_model)
