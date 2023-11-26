# Format

## definition

```js
[sug:type]
[type:dom] [subject:myth]
(love) bold
[hate]  italic

/\[(.?[^])\]/g
// Expected: a <b> [] <c> Result: a <b> [] <c>
'a [b] [] [c]'.replace(/\[(.?[^])\]/g,'<$1>')

// Expected: a <b> [] <c:a> Result: a <b> [] [c:a]
'a [b] [] [c:a]'.replace(/\[(.?[^])\]/g,'<$1>')

'a [b] [] [c:a]'.replace(/\[(.+[^])\]/g,'<$1>')
'a <b] [] [c:a>'

'a [b] [] [c:a]'.replace(/\[(.?[^])\]/g,'<$1>')
'a <b> [] [c:a]'

'a [b] [] [c:a]'.replace(/\[(.*?[^])\]/g,'<$1>')
'a <b> <] [c:a>'

'a [b] [] [c:a]'.replace(/\[(.+?[^])\]/g,'<$1>')
'a <b] [> <c:a>'

/\[(.*?)\]/g
a [b] [] [c]
a [b] [] [c:a]


// Expected: a <b> [] <c:a>  Result: a <b> [] <c:a>
'a [b] [] [c:a]'.replace(/\[(.?[^]\w?)\]/g,'<$1>')


'a [b] [] [c:a]'.replace(/\[(.*?)\]/g,'<$1>')


"la <abc> <:a> <a/b/c>".replace(/\<(.+?)\>/g,'[$1]')
> 'la [abc] [:a] [a/b/c]'

abc [list:bracket/parenthesis/round bracket]; 

abc <bracket/parenthesis/round bracket>; 
abc [:<bracket/parenthesis/round bracket>]; 
abc <:[bracket/parenthesis/round bracket]>; 

[usu:be earmarked] 

'word1/<word2/word3>/word 4/word 4/<word2/ word3>'.replace(/\/(?![^<]*>)/g,'-')
> word1-<word2/word3>-word 4-word 4-<word2/ word3>

'[] <bracket/parenthesis/round bracket> / abc <a/b>'.replace(/\/(?![^<]*>)/g,'-')
> [] <bracket/parenthesis/round bracket> - abc <a/b>

[list:abc] [list:org] love [:abc]
(~ [list:what])  love [list:org/king]

UPDATE `blog` SET `content` = REGEXP_REPLACE(`content`,'\\[list:(.*?)\]','<$1>') WHERE `content` LIKE '%[list:%';
<abc> <org> love [:abc]
(~ <what>)  love <org/king>

```

```sql
-- sense.row: 6 695 (35.0MB)
-- exam.row: 1 002
SELECT * from list_sense WHERE sense LIKE "%[list:%" ;
UPDATE list_sense SET `sense` = REGEXP_REPLACE(`sense`,'\\[list:(.*?)\]','<$1>') WHERE `sense` LIKE '%[list:%';
UPDATE list_sense SET `exam` = REGEXP_REPLACE(`exam`,'\\[list:(.*?)\]','<$1>') WHERE `exam` LIKE '%[list:%';

SELECT * from list_sense WHERE sense LIKE "%။ %" ;
%။ %
sense.row: 33 111 = 33 111
exam.row: 366
UPDATE list_sense SET `sense` = REGEXP_REPLACE(`sense`,'။ ','; ') WHERE `sense` LIKE '%။ %';
sense.row: 61 942
UPDATE list_sense SET `sense` = REGEXP_REPLACE(`sense`,'။','') WHERE `sense` LIKE '%။';

SELECT * from list_sense WHERE sense LIKE "%။%" ;
-- ...သမား။...အိုး; (မကောင်းသည့် အနက်ဖြင့် သုံးလေ့ရှိသည်။)
-- 388
UPDATE list_sense SET `sense` = REGEXP_REPLACE(`sense`,'။)',')') WHERE `sense` LIKE '%။)%';
UPDATE list_sense SET `exam` = REGEXP_REPLACE(`exam`,'။','') WHERE `exam` LIKE '%။';


list_sense -> emd_sense
english_myanmar_sense -> emd_sense eml lem
myanmar_english_sense -> med_sense mel lme
```
