from django.db.models import Prefetch
from ...models import OmeWord, OmeSense, OmeReference, OmeThesaurus, TypeWord
import collections
from collections import defaultdict

# word_suggest
# word_definition
class MedService:
    """
    Handles the business logic for retrieving and processing medical dictionary data.
    """

    def word_suggestion(self, query_params):
        """
        Provides word suggestions based on the query parameter 'q'.
        """
        word = query_params.get('q', '').strip().lower()

        if not word:
            words = OmeWord.objects.all()[:6]
            return [{'w': w.word, 'n': 1, 't': 0} for w in words]

        start_with = list(OmeWord.objects.filter(word__startswith=word).values_list('word', flat=True))

        if len(start_with) <= 20:
            return [{'w': e, 'n': 1, 't': 0} for e in start_with]

        res = []
        _length = len(word) + 1
        limit_with = [e[:_length] for e in start_with]
        cat = collections.Counter(limit_with)

        for w_prefix, count in cat.items():
            if count == 1:
                original_word = next((s for s in start_with if s.startswith(w_prefix)), w_prefix)
                res.append({'w': original_word, 'n': 1, 't': 0})
            else:
                res.append({'w': w_prefix, 'n': count, 't': 0})

        return res
    
    def word_definition(self, word_str):
        """
        Retrieves a full dictionary entry for a given word, including senses,
        references, and thesaurus entries, using optimized queries.

        Args:
            word_str (str): The exact word to look up.

        Returns:
            dict: A structured dictionary containing the word's full details.
        """
        try:
            # FIX: Use Django's default reverse accessor names (e.g., 'medsense_set')
            # This works whether or not `related_name` is defined in the models.
            word_obj = OmeWord.objects.prefetch_related(
                Prefetch('medsense_set', queryset=OmeSense.objects.select_related('wrte', 'trid')),
                'medreference_set',
                Prefetch('medthesaurus_set', queryset=OmeThesaurus.objects.select_related('wlid', 'cate'))
            ).get(word__iexact=word_str)

        except OmeWord.DoesNotExist:
            return None # The view will handle this and return a 404

        # FIX: Access the prefetched data using the default reverse accessor names.
        senses_data = [
            {
                "pos": sense.wrte.name if sense.wrte else "N/A", # Part of Speech
                "term_type": sense.trid.name if sense.trid else "N/A",
                "definition": sense.sense,
                "example": sense.exam,
            }
            for sense in word_obj.medsense_set.all()
        ]

        # FIX: Access the prefetched data using the default reverse accessor names.
        thesaurus_data = defaultdict(list)
        for entry in word_obj.medthesaurus_set.all():
            category = entry.cate.name if entry.cate else "Uncategorized"
            related_word = entry.wlid.word if entry.wlid else "N/A"
            thesaurus_data[category].append(related_word)
        
        # FIX: Access the prefetched data using the default reverse accessor names.
        references_data = [
            {
                "etymology": ref.etymology,
                "reference_text": ref.reference,
                "variant": ref.variant
            }
            for ref in word_obj.medreference_set.all()
        ]

        # Assemble the final result
        result = {
            "id": word_obj.id,
            "word": word_obj.word,
            "ipa": word_obj.ipa,
            "senses": senses_data,
            "thesaurus": dict(thesaurus_data), # Convert defaultdict to regular dict
            "references": references_data,
        }
        return result

