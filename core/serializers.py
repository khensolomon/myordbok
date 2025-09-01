from rest_framework import serializers
from .models import ListWord

class ListWordSerializer(serializers.ModelSerializer):
    class Meta:
        model = ListWord
        fields = ['id', 'word', 'derived']