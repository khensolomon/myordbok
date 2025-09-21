#!/bin/bash

# ==============================================================================
#  Universal Cache Invalidation Script
# ==============================================================================
# version: 2025.09.18.2
#
#  Description:
#  A professional, multi-purpose script to clear the Django application cache.
#  It can clear the entire cache, a single word/language pair, or a list of
#  words from a file.
#
#
#  Usage Examples:
#  ------------------------------------------------------------------------------
#  1. Display the help message:
#     ./clear_caches.sh --help
#
#  2. Clear the entire application cache:
#     ./clear_caches.sh --all
#
#  3. Clear a single, specific search entry from the cache:
#     ./clear_caches.sh --word="love" --lang="en"
#
#  4. Clear multiple search entries from a text file:
#     ./clear_caches.sh --file="../tmp/words_to_clear.txt" --lang="en"
# ==============================================================================

# --- Configuration ---
# The relative path to your project's manage.py file from this script's location.
MANAGE_PY_PATH="../manage.py"


# --- Help Function ---
show_help() {
    echo "Usage: ./clear_caches.sh [options]"
    echo ""
    echo "A universal script to clear the Django application cache."
    echo ""
    echo "Options:"
    echo "  -a, --all              Clear the entire application cache."
    echo "  -w, --word WORD        Specify a single word to clear from the cache."
    echo "  -l, --lang LANG        Specify the language ID for the word (required with -w or -f)."
    echo "  -f, --file FILE_PATH   Specify a text file containing a list of words to clear."
    echo "  -h, --help             Display this help message and exit."
    echo ""
    echo "Examples:"
    echo "  ./clear_caches.sh --all"
    echo "  ./clear_caches.sh --word=\"love\" --lang=\"en\""
    echo "  ./clear_caches.sh --file=\"../tmp/words_to_clear.txt\" --lang=\"en\""
}


# --- Argument Parsing ---
WORD=""
LANG=""
FILE_PATH=""
CLEAR_ALL=false

while [[ $# -gt 0 ]]; do
    key="$1"
    case $key in
        -h|--help)
        show_help
        exit 0
        ;;
        -a|--all)
        CLEAR_ALL=true
        shift # past argument
        ;;
        -w|--word)
        WORD="$2"
        shift # past argument
        shift # past value
        ;;
        -l|--lang)
        LANG="$2"
        shift # past argument
        shift # past value
        ;;
        -f|--file)
        FILE_PATH="$2"
        shift # past argument
        shift # past value
        ;;
        *)    # unknown option
        echo "Unknown option: $1"
        show_help
        exit 1
        ;;
    esac
done


# --- Script Logic ---

if [ "$CLEAR_ALL" = true ]; then
    # --- Scenario 1: Clear the entire cache ---
    echo "Attempting to clear the entire cache..."
    python "$MANAGE_PY_PATH" clearcache
    echo "-------------------------------------"
    echo "Done."

elif [ -n "$FILE_PATH" ]; then
    # --- Scenario 2: Clear words from a file ---
    if [ -z "$LANG" ]; then
        echo "Error: The --lang option is required when using --file."
        show_help
        exit 1
    fi
    if [ ! -f "$FILE_PATH" ]; then
        echo "Error: Input file not found at '$FILE_PATH'"
        exit 1
    fi

    echo "Starting bulk cache invalidation from file..."
    echo "Reading words from: $FILE_PATH"
    echo "Target language: $LANG"
    echo "-------------------------------------"

    while IFS= read -r word || [[ -n "$word" ]]; do
        if [ -z "$word" ]; then continue; fi
        echo "Clearing cache for: '$word'"
        python "$MANAGE_PY_PATH" clearcache --word="$word" --lang="$LANG"
    done < "$FILE_PATH"

    echo "-------------------------------------"
    echo "Bulk invalidation from file complete."

elif [ -n "$WORD" ]; then
    # --- Scenario 3: Clear a single word ---
    if [ -z "$LANG" ]; then
        echo "Error: The --lang option is required when using --word."
        show_help
        exit 1
    fi
    python "$MANAGE_PY_PATH" clearcache --word="$WORD" --lang="$LANG"
    echo "-------------------------------------"
    echo "Done."
else
    # --- No valid options provided ---
    echo "No action specified."
    show_help
    exit 1
fi

