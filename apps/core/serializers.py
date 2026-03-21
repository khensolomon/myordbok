"""
serializers.py
"""
from rest_framework import serializers
from .models import OemWord

class ListWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = OemWord
        fields = ['id', 'word', 'derived']