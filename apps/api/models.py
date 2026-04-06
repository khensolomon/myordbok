from django.db import models

# class Lang(models.Model):
#     # id = models.IntegerField(primary_key=True, default=0)
#     id = models.AutoField(primary_key=True)
#     name = models.CharField(max_length=50)
#     dir = models.TextField()

#     class Meta:
#         db_table = 'lang'
#         managed = True # Binds to existing MySQL table

#     def __str__(self):
#         return self.name
