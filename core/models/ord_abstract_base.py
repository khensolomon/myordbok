"""
models.ord_base

Description:
------------
This module defines the base model for language-specific word tables and imports
auto-generated language models.

- AbstractOrdBase: defines the shared schema for all word tables, including fields
  `word`, `sense`, `usage`, and `status`.
- Generated language models (e.g., OrdEN, OrdNO) are imported from
  /project/tmp/ord_models.py. Each model corresponds to a database table
  `ord_<lang_id>` and inherits from AbstractOrdBase.

Usage:
------
- AbstractOrdBase serves as the parent class for additional word tables if needed.
- Generated models can be accessed like regular Django models:

    from project.app.models.ord import OrdEN, OrdNO

- Language models can be regenerated after updating DICTIONARIES using the command:

    python manage.py generate_ord_models

Notes:
------
- Generated models in tmp/ord_models.py should not be edited manually.
- Changes to AbstractOrdBase propagate to all language tables during migrations.
- This module is part of the `dictionary` app.
"""
from django.db import models

class OrdAbstractBase(models.Model):
    word = models.CharField(
        max_length=250, null=True, blank=True, db_index=True,
        help_text="eg. elske"
    )
    sense = models.TextField(
        null=True, blank=True,
        help_text="eg. love; dear"
    )
    usage = models.TextField(
        null=True, blank=True,
        help_text="example"
    )
    status = models.IntegerField(
        null=True, blank=True,
        help_text="0: default, 1: working, 2: done, 3: not good"
    )

    class Meta:
        abstract = True

