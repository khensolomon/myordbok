"""
version: 2025.09.27.1

A centralized location for constants used throughout the search engine.
"""
from enum import Enum

class SearchState(str, Enum):
    """
    Defines the set of possible states for a search result, providing a
    single source of truth and preventing the use of magic strings.
    """
    SUCCESS = "result"
    NOT_FOUND = "notfound"
    INVALID_QUERY = "pleaseenter"
    # SUCCESS = "SUCCESS"
    # NOT_FOUND = "NOT_FOUND"
    # INVALID_QUERY = "INVALID_QUERY"
