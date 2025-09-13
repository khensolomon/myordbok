# Parser

## Fields structure

```bash
မန္တလေး~သူငယ်ချင်း; တုံးအောက်~ဖား
in compounds such as <~ကတိုး/~ကတစ်>
<သူခိုး> vs <ကြက်သွန်>

[type:REG, usage:colloq]
[type:TIME, usage:arch]
[type:DOM, subject:gram]
[type:STYLE, usage:fig]

[Mon:ကျာက်; Sans:ၐြီ]
[illus:လှည်း]
[=:ကင်းစင်]
[~:Coccinia indica]
[also:ဒုဗ္ဘိက္ခန္တရကပ်/သတ္ထန္တရကပ်/ရောဂန္တရကပ်]
[see:ခေါင်းတုံး]
[eg:example;usage]

take part in games <football/volleyball>

```

This is the <field> containing various [and:structures/formats] that require a good parser.; This is the second line of the current field containing its own example row [eg:its break because of semi-colon]

## Fields parser

```bash
...
```

## match

```js
// A <a class="def" href="FIGURE">figure</a> that <a class="def" href="BRANCH">branches</a> from a <a class="def" href="SINGLE">single</a> <a class="def" href="ROOT">root</a>
s.replace(/<a[^>]*>([\s\S]*?)<\/a>/g, "<$1>");
// A <figure> that <branches> from a <single> <root>
```
