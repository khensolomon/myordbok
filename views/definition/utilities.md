# template

```pug
mixin wordlink(q)
  a(href='definition?q='+q.toLowerCase())= q
//- mixin test(q)
//-   q.replace(/\{-(.*?)\-}/g, '<a href="definition?q=$1">$1</a>')

//- mixin example(eg)
  //- eg.replace(/{-/g,'<a href="definition?q=').replace(/-:-/g,'">').replace(/-}/g,'</a>')

mixin meaning(row)
  each define,grammar in row
    div.pos(class=grammar.toLowerCase())
      h2= grammar
      div
        each mean,ty in define
          p!= mean.v.replace(/\((.*?)\)/g, '<em>$1</em>').replace(/\{-(.*?)\-}/g, '<a href="definition?q=$1">$1</a>').replace(/\[(.*?)\]/g, '<b>$1</b>')
          if mean.exam
            ul.eg
              each eg in mean.exam
                li!= eg.replace(/\((.*?)\)/g, '<em>$1</em>').replace(/\{-(.*?)\-}/g, '<a href="definition?q=$1">$1</a>')

mixin notation(row)
  div.notation
    h2= row.number
    div
      each k in row.notation
        p= k.sense
          if row.alpha
            each num in row.alpha
              +wordlink(num)

mixin message(raw)
  div.message
    ol
      each row in raw
        li
          p= row.msg
            if row.list && row.list.length
              | :
              each word in row.list
                | ~
                +wordlink(word)

mixin suggestion(row)
  if row.length
    div.suggestion
      p
        each word in row
          +wordlink(word)

mixin thesaurus(row)
  if row && row.length
    div.thesaurus.synonym
      h3 Thesaurus
      div
        ol
          each word in row
            li
              +wordlink(word)

mixin formOf(row)
  if row.length
    div.thesaurus.formOf
      h3 ...form Of
      div
        each k in row
          p!= k.replace(/\{-(.*?)\-}/g, '<a href="definition?q=$1">$1</a>')

mixin Pos(row)
  if row.length
    dl.thesaurus.pos
      dt
        h3 ...Pos tmp ???
      dd
        ul
          each k in row
            li!= k.v.replace(/\{-(.*?)\-}/g, '<a href="definition?q=$1">$1</a>')

mixin result(o)
  each row in o
    if Array.isArray(row.clue)
      +translation(row)
    else
      +definition(row)

mixin translation(row, w)
  div.translation(data-lang=lang.tar)
    p= row.word
      span.speech(class=lang.tar).zA.icon-volume-up
    div
      each e in row.clue
        +definition(e)

mixin definition(raw)
  div.definition(data-lang=lang.src)
    h1= raw.word
      //- span.speech.en.zA.icon-volume-up
      speech-engine(word=raw.word lang='en')
    div.meaning
      each row, name in raw.clue
        +#{name}(row)
