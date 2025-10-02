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
[etc:learning/adventure/nature]
[with:passionate]
(~ [taking/accepting] somebody)
[sing] ဒေါသထွက်ခြင်း
[sing] ~ for sth မက်မောခြင်း
[as in:chess] ကျားကစားရာတွင်ကင်း
fly into a passion (ie become very angry).

<first/greatest>
accredit <school/course>
<play/love>
(~ sb as sth)
(~ no <passive>, sometimes in the -ing form to indicate an intention or arrangement for the future)
(indicating a relationship) I have two sisters.

(~ used with <n> and <past participle>)
(~ used with <n> and <past participle>)
(~ used in , esp after <will not/cannot> etc)
(~ no <passive>)
(~ 3rd pers sing prest ~ has/had to) (~ in , or <question>, usually formed with <do>)
(~ esp <ironic>)

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
