# Scripts

## Cache works for Workflow

..automated process for handling a bulk update of 1,000 words:

**Generate a Word List:** bulk SQL import script should be designed to output a simple text file, `words_to_clear.txt`, containing only the words that were changed.

```text
love
hate
bracket
... (997 more words) ...
```

**Run the Automation Script:** Make the script executable once:

```bash
chmod +x <project>/scripts/clear_caches.sh
```

To Clear Everything:

```bash
./scripts/clear_caches.sh --all
```

To Clear a Single Word:

```bash
./scripts/clear_caches.sh --word="love" --lang="en"
```

To Clear a List of Words from a File:
First, create your file (e.g., `<project>/tmp/words_to_clear.txt`):

```text
love
hate
bracket
```

Then, run the command:

```bash
./scripts/clear_caches.sh --file="tmp/words_to_clear.txt" --lang="en"
```

Help:

```bash
./scripts/clear_caches.sh --help
```
