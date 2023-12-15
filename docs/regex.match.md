# Regex

## match

```js
// A <a class="def" href="FIGURE">figure</a> that <a class="def" href="BRANCH">branches</a> from a <a class="def" href="SINGLE">single</a> <a class="def" href="ROOT">root</a>
s.replace(/<a[^>]*>([\s\S]*?)<\/a>/g,"<$1>")
// A <figure> that <branches> from a <single> <root>
