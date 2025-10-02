# Cache

## clearcache

Clear Everything:

```bash
python manage.py clearcache
```

Clear a Specific Word:

```bash
# To clear the cache for the English word "love"
python manage.py clearcache --word="love" --lang="en"

# To clear the cache for the Norwegian word "avbilde"
python manage.py clearcache --word="avbilde" --lang="no"
```

Cache file list

- `version-page-query.extension`

`filename`

| Version |       Page | Language | query | extension |
| ------: | ---------: | -------: | ----: | --------: |
|     175 | definition |       en |  word |      json |

## clear cache

```sh
rm version-*.json
rm -v !("175-*")
rm -v !("175-*.json")
rm -i !("175-*.json")
rm file[1-9][1-9][1-9].txt file[1-9][1-9].txt
rm ![175]-*.json
rm (^1)-*.json
```
