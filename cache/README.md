# Cache

Cache file list

- `version-page-query.extension`
  
`filename`

| Version| Page       | Language  | query      | extension |
|-------:|-----------:|----------:|-----------:|----------:|
|  175  |  definition |     en    |    word    | json      |

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
