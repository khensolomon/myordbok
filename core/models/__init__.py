"""
models
"""
# Import models from each file to make them accessible from core.models
from .dictionary import (
  TypeWord, TypeDerived,
  ListWord, ListSense,
  MapDerived, MapThesaurus, MapSimilar, MapAntonym
)

from .fonts import ListFont, FontType, FontStatus
from .other import (
  Note, Post, Comment
)

# Optionally define __all__ to control what `from .models import *` imports
__all__ = [
  'TypeWord', 'TypeDerived',
  'ListWord', 'ListSense',
  'MapDerived', 'MapThesaurus', 'MapSimilar', 'MapAntonym',
  'ListFont','FontType','FontStatus',
  'Note', 'Post', 'Comment'
]
