"""
models
"""
# Import models from each file to make them accessible from core.models
from .oem import (
  TypeWord, TypeDerived,
  ListWord, ListSense,
  MapDerived, MapThesaurus, MapSimilar, MapAntonym
)
from .ome import (
  MedWord, MedSense, MedReference, MedThesaurus
)

from .fonts import ListFont, FontType, FontStatus
from .other import (
  Note, Post, Comment
)
from .ord import *

# Optionally define __all__ to control what `from .models import *` imports
__all__ = [
  'TypeWord', 'TypeDerived',
  'ListWord', 'ListSense',
  'MapDerived', 'MapThesaurus', 'MapSimilar', 'MapAntonym',
  'MedWord', 'MedSense', 'MedReference', 'MedThesaurus',
  'ListFont','FontType','FontStatus',
  'Note', 'Post', 'Comment'
]
