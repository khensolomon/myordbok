"""
models.med
"""
from django.db import models

class OmeWord(models.Model):
    word = models.CharField(unique=True, max_length=255)
    ipa = models.CharField(max_length=255, blank=True, null=True)
    mlc = models.CharField(max_length=255, blank=True, null=True)
    cate_count = models.IntegerField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = 'ome_word'

class OmeSense(models.Model):
    wrid = models.ForeignKey('OmeWord', models.DO_NOTHING, db_column='wrid', db_comment='word id')
    wrte = models.ForeignKey('TypeWord', models.DO_NOTHING, db_column='wrte', db_comment='word type of POS')
    rfid = models.IntegerField(db_comment='word reference id')
    cate = models.IntegerField(blank=True, null=True, db_comment='category')
    trid = models.ForeignKey('TypeTerm', models.DO_NOTHING, db_column='trid', blank=True, null=True, db_comment='0:unknown, 1:word, 2:phrase, 3:sentence')
    sense = models.TextField(blank=True, null=True, db_comment='Definition')
    exam = models.TextField(blank=True, null=True, db_comment='Example')
    wseq = models.IntegerField(default=0)
    wrkd = models.IntegerField(blank=True, null=True, db_comment='Source id')
    usg = models.TextField(blank=True, null=True)
    ref = models.TextField(blank=True, null=True)
    note = models.TextField(blank=True, null=True)
    dated = models.DateTimeField()

    class Meta:
        managed = True
        db_table = 'ome_sense'

class OmeReference(models.Model):
    wrid = models.ForeignKey('OmeWord', models.DO_NOTHING, db_column='wrid')
    etymology = models.TextField(blank=True, null=True)
    reference = models.TextField(blank=True, null=True)
    variant = models.TextField(blank=True, null=True)

    class Meta:
        managed = True
        db_table = 'ome_reference'

class OmeThesaurus(models.Model):
    wrid = models.ForeignKey('OmeWord', models.DO_NOTHING, db_column='wrid')
    wlid = models.ForeignKey('OmeWord', models.DO_NOTHING, db_column='wlid', related_name='omethesaurus_wlid_set')
    cate = models.ForeignKey('TypeWord', models.DO_NOTHING, db_column='cate', blank=True, null=True, db_comment='category')

    class Meta:
        managed = True
        db_table = 'ome_thesaurus'