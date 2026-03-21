"""
version: 2025.09.13.3

A simple utility to handle IPA conversion for English words.
"""
import eng_to_ipa as ipa

class IpaGenerator:
    """
    A wrapper for the eng-to-ipa library to provide a consistent
    interface for generating IPA transcriptions.
    """
    @staticmethod
    def get_ipa(word: str) -> str:
        """
        Converts an English word to its IPA representation.

        Args:
            word: The English word to convert.

        Returns:
            A string containing the IPA transcription, or an empty string
            if the conversion is not possible or results in an error.
        """
        if not word or not word.isalpha():
            return ""
        try:
            # The trans V_as_in_latvia=True flag can sometimes provide better results
            # for words with ambiguous 'v' sounds.
            transcription = ipa.convert(word)
            # Often returns with asterisks for unknown words, we'll clean that.
            return transcription.replace('*', '')
        except Exception:
            # If any error occurs during conversion, return an empty string.
            return ""
