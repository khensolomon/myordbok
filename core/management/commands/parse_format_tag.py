"""
python manage.py parse_format_tag "I love <python/django> and [list:framework/library]"
python manage.py parse_format_tag --file ./cache/test-format-tag.txt

this is an <example> with a [or:link/tw]
"""
import re
import os
from django.core.management.base import BaseCommand


class MakeupTagger:
    """
    Handles the regex-based 'makeup' transformation.
    Can be copied directly into your module later.
    """

    def __init__(self, rcw=None):
        self.rcw = rcw or None
        self.plain_name = ["list", "exam"]

    def transform(self, s: str) -> str:
        """Apply the makeup transformation to a string"""

        # <...> → {-word-}
        def angle_replace(match):
            v = match.group(1)
            return ", ".join("{-*-}".replace("*", w) for w in v.split("/"))

        s = re.sub(r"<(.+?)>", angle_replace, s)

        # [name:value]
        def bracket_replace(match):
            t = match.group(1)
            if not t:
                return "<span class='bracket square'>-</span>"

            parts = t.split(":")
            name = parts[0] if len(parts) > 0 else ""
            v = parts[1] if len(parts) > 1 else None

            if not v:
                return match.group(0)

            sep = " " if name == "with" else "/"
            links = ["{-*-}".replace("*", word) for word in v.split(sep)]
            href = ", ".join(links)

            if self.rcw:
                href = re.sub(self.rcw["needle"], self.rcw["hay"], href)

            if name in ("", None) or name in self.plain_name:
                return href
            elif name == "with":
                return " ".join(links)
            elif name == "etc":
                return (f"{href} etc").replace(",", " or", 1).strip()
            elif name == "type":
                return f"[{href}]"
            elif name == "user":
                return f"[{href}]".replace(",", " and", 1)
            else:
                if self.rcw and self.rcw["needle"] == name:
                    return f"(-rcwNde-) {href}"
                return f"(-{name}-) {href}"

        s = re.sub(r"\[(.*?)\]", bracket_replace, s)

        # Replace ~ if rcw.needle == "~"
        if self.rcw:
            hay_link = "{-*-}".replace("*", self.rcw["hay"])
            if self.rcw["needle"] == "~":
                s = re.sub(r"~(?![^{]*})", hay_link, s)
            s = re.sub(self.rcw["needle"], self.rcw["hay"], s).replace(
                "rcwNde", self.rcw["needle"]
            )

        # Empty bracket replacements
        s = re.sub(r"\(\)", "<span class='bracket round parenthesis'>-</span>", s)
        s = re.sub(r"<>", "<span class='bracket angle'>-</span>", s)
        s = re.sub(r"\{\}", "<span class='bracket curly'>-</span>", s)

        return s


class Command(BaseCommand):
    help = "Run the regex link transformation on text or a file"

    def add_arguments(self, parser):
        parser.add_argument(
            "input",
            type=str,
            help="Input text or file path",
        )
        parser.add_argument(
            "--needle",
            type=str,
            help="Regex needle to replace",
            default=None,
        )
        parser.add_argument(
            "--hay",
            type=str,
            help="Replacement for needle",
            default=None,
        )
        parser.add_argument(
            "--file",
            action="store_true",
            help="Treat input as a file path instead of raw text",
        )

    def handle(self, *args, **options):
        rcw = (
            {"needle": options["needle"], "hay": options["hay"]}
            if options["needle"]
            else None
        )
        tagger = MakeupTagger(rcw=rcw)

        if options["file"]:
            file_path = options["input"]
            if not os.path.exists(file_path):
                self.stderr.write(self.style.ERROR(f"File not found: {file_path}"))
                return

            with open(file_path, "r", encoding="utf-8") as f:
                content = f.read()

            result = tagger.transform(content)

            base, ext = os.path.splitext(file_path)
            new_file = f"{base}-makeup-tag{ext}"

            with open(new_file, "w", encoding="utf-8") as f:
                f.write(result)

            self.stdout.write(self.style.SUCCESS(f"Processed file saved as: {new_file}"))
        else:
            text = options["input"]
            result = tagger.transform(text)
            self.stdout.write(self.style.SUCCESS(result))