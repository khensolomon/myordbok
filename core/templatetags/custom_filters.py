import re
from django import template

register = template.Library()

@register.filter
def dot_slug(value):
    """Lowercase and replace spaces with dots instead of hyphens."""
    return re.sub(r'\s+', '.', value.strip().lower())

@register.filter
def quoteify(value):
    """Replace 'something' with <q>something</q>."""
    return re.sub(r"'(.*?)'", r"<q>\1</q>", value)

@register.filter
def quoteify(value):
    """Replace 'something' with <q>something</q>."""
    return re.sub(r"'(.*?)'", r" <q>\1</q> ", value or "")

@register.filter
def emphasize(value):
    """Replace 'something' with <em>something</em>."""
    return re.sub(r"'(.*?)'", r" <em>\1</em> ", value or "")

@register.filter
def strongify(value):
    """Replace 'something' with <strong>something</strong>."""
    return re.sub(r"'(.*?)'", r" <strong>\1</strong> ", value or "")