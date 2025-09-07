"""
Management command: generate_ord_models

Description:
------------
This command generates Django model classes for language-specific word tables.
Each table has the same schema (defined in OrdAbstractBase) but a different name
following the pattern `ord_<lang_id>`. For example:

    class OrdEN(OrdAbstractBase):
        class Meta:
            db_table = "ord_en"

The source of truth for which languages to generate comes from the DICTIONARIES
list defined in `project/app/data.py`. Each entry contains metadata about the
language (id, name, and optionally a "my" label in Burmese).

Generated Output:
-----------------
The command writes a Python file to:

    /project/tmp/ord_models.py

This file will contain one model per language with an appropriate docstring
for human readability (language name + Burmese translation).

The generated file is safe to overwrite — it should not edit it manually.
Your hand-written base class `OrdAbstractBase` remains in:

    /project/app/models/ord.py

And `ord.py` imports the generated classes like so:

    from project.tmp.ord_models import *

Usage:
------
Run the command from the project root:

    python manage.py generate_ord_models

Then make migrations to create/update the corresponding database tables:

    python manage.py makemigrations
    python manage.py migrate

Notes:
------
- Adding or removing languages is as simple as updating DICTIONARIES and
  re-running this command.
- If no /project/tmp directory exists, it will be created automatically.
- Each generated model includes a docstring for better clarity in code and Django Admin.


    class_names = [f"Ord{lang['id'].upper()}" for group in DICTIONARIES for lang in group["lang"]]
"""
import os
from django.core.management.base import BaseCommand
from django.conf import settings

from config import data

class Command(BaseCommand):
    help = "Generate Ord<LANG> models from DICTIONARIES list"

    def handle(self, *args, **options):
        # Collect all language codes with metadata
        langs = []
        for group in data.DICTIONARIES:
            for lang in group["lang"]:
                langs.append(lang)

        # Start building Python code
        lines = []
        # lines.append('"""\nmodels.ord_*\nAUTO-GENERATED MODELS\n"""\n')
        lines.append('"""')
        lines.append('\nAUTO-GENERATED MODELS - DO NOT EDIT DIRECTLY')
        lines.append('\nmodels.ord_*')
        lines.append('\n"""\n')
        # lines.append("from django.db import models\n")
        # lines.append("from project.app.models.ord import OrdAbstractBase\n\n\n")
        lines.append("from .ord_abstract_base import OrdAbstractBase\n\n")
        # lines.append("# === AUTO-GENERATED MODELS ===\n\n")

        for lang in sorted(langs, key=lambda l: l["id"]):
            lang_id = lang["id"].lower()
            class_name = f"Ord{lang_id.upper()}"
            table_name = f"ord_{lang_id}"
            lang_name = lang.get("name", "")
            lang_my = lang.get("my", "")

            lines.append(f"class {class_name}(OrdAbstractBase):\n")
            lines.append(f'    """\n')
            lines.append(f"    {lang_name} ({lang_id})\n")
            # if lang_my: lines.append(f"    {lang_my}\n")
            lines.append(f'    """\n')
            lines.append("    class Meta:\n")
            # lines.append(f"        managed = False\n")
            lines.append(f"        db_table = \"{table_name}\"\n\n")

        # Output path under /project/tmp
        tmp_dir = os.path.join(settings.BASE_DIR, "tmp")
        os.makedirs(tmp_dir, exist_ok=True)
        out_path = os.path.join(tmp_dir, "ord_models.py")

        with open(out_path, "w", encoding="utf-8") as f:
            f.write("".join(lines))

        self.stdout.write(self.style.SUCCESS(
            f"Generated {len(langs)} models → {out_path}"
        ))
