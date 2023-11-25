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

'word1/<word2/word3>/word 4/word 4/<word2/ word3>'.replace(/\/(?![^<]*>)/g,'-$1-')
'[] <bracket/parenthesis/round bracket> / abc <a/b>'.replace(/\/(?![^<]*>)/g,'-$1-')

[list:abc] [list:org] love [:abc]
(~ [list:what])  love [list:org/king]

UPDATE `blog` SET `content` = REGEXP_REPLACE(`content`,'\\[list:(.*?)\]','<$1>') WHERE `content` LIKE '%[list:%';
<abc> <org> love [:abc]
(~ <what>)  love <org/king>

UPDATE blog SET content = PREG_REPLACE('[list:(.*)$]', '<$1>', content);
```
