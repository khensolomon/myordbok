# Reading a query

What is typed in the search box is read before anything is fetched, and the
answer is what the reader wanted from it, built from the dataset alone. A
fact the dataset does not hold (who is king today) is never made up; the
words of the question are explained instead.

Code: `shared/query/` (browser and Worker), `app/reader/query.js`,
`app/reader/answer.js`, `app/reader/entry.js`, `worker/routes/phrase.js`,
`worker/routes/spelling.js`. Every row below is a case in `tests/query.test.js`,
`tests/phrase.test.js` or `tests/worker.test.js`.

## Steps

| Step | Runs in | Does |
|---|---|---|
| 0. Tidy | browser | Unicode NFC, invisible characters removed, spaces collapsed; capitals kept (`AI` and `ai` differ). |
| 1. Answer locally | browser | Number, sum, percentage, time, date; a sum read two ways asks; a sum without an answer says why. Nothing is fetched. |
| 2. Take the question off | browser | The words around the subject are removed and the subject kept, with the part asked about (`#synonyms`, `#opposite`, `#forms`). The question stays in the address (`asked=`). |
| 3. Entry | Worker | The subject as a headword, ignoring case; a form leads to its root (went → go); punctuation around a single word ignored (`love!`, `ချစ်။`). |
| 4. Phrase | Worker | Not an entry, but one of the phrase patterns: each part found as typed, as a form's root or by spelling; the sense that fits chosen; the Myanmar put together. |
| 5. Sentence | Worker, then browser | Several words: English split at spaces, Myanmar split into headwords (below). The first word's entry comes with the answer; each other word is fetched when opened. |
| 6. Nothing | Worker | Did you mean (one edit away), words that start the same way, a way to suggest it. |

Steps 3 to 6 are one request, `/api/read` (`worker/routes/read.js`), so a
slow connection waits once for any query.

`exact=1` skips steps 1 and 2 and looks up the text as typed.

## What was typed, what is wanted, what is shown

| Typed | Wanted | Shown |
|---|---|---|
| `love` | the meaning | the entry |
| `101`, `၁၀၁`, `one hundred and one`, `တစ်ရာ့တစ်` | the number in words | digits in both scripts, Myanmar and English words |
| `1+1`, `x= 5x1`, `10% of 70`, `70 + 10%` | the answer | the answer, the sum as read |
| `10 % 19` | unclear | a question: 10% of 19, or the remainder |
| `20, 30, 50 percentage` | each number's share | a table of shares |
| `what time it is`, `what is the date` | the time, the date | from the device clock, in both languages |
| `what is love`, `explain love`, `tell me what is love`, `what does love mean` | the meaning | the entry for love, saying how the question was read |
| `similar word of love`, `opposite of hot`, `past tense of go` | one part of an entry | the entry, at that part, or a line saying it is not listed |
| `how do you say love in Myanmar`, `love in burmese` | the Myanmar | the entry |
| `what is AI`, `tell me what is ai` | the meaning | the entry for AI (matching ignores case) |
| `god` | the meaning | each spelling the dataset has as its own headword: God, then god |
| `king of Denmark`, `what is the king of danmark`, `who is the king of Norway` | what the phrase means | each word as its own headword (king, Denmark), the sense that fits first and marked; beside them, the phrase and its Myanmar reading (ဒိန်းမတ် ဘုရင်) |
| `big house`, `school bus` | what the phrase means | the phrase, as above |
| `king of the castle` | the idiom | the entry: a whole phrase that is a headword wins |
| `love is good, love is an open door` | each word | one word at a time |
| `ချစ်သူရေသောက်`, `အချစ်ဆိုတာဘာလဲ` (no spaces) | each word | split into headwords, one word at a time |
| `lvoe` | love | did you mean, then a way to suggest it |

## Phrases

Patterns (`shared/query/phrase.js`):

- **X of Y**: about X, Y says whose or which. Myanmar order is Y X:
  king of Denmark → ဒိန်းမတ် ဘုရင်.
- **A B**: about B, A describes it. Myanmar keeps the order of the glosses:
  big house → ကြီးသော အိမ်.

Articles are left out; two words joined by a linking word (`love is`) are a
sentence, not a phrase; more than four words are a sentence.

Each part is found as typed, else as the root of a form (kings → king), else
by spelling (danmark → Denmark), and the note says which.

The sense of each part:

1. For the X of "X of Y", a sense whose example uses the same pattern, and
   of those the one whose example has a name after "of" when Y is a name (a
   country, a capital city, a capitalised word): king of Denmark takes the
   sense with "the King of Spain", king of water the one with "the king of
   jazz".
2. Otherwise the first sense of the expected part of speech that is not a
   draft, else the first.

The Myanmar line is made from the first gloss of each chosen sense, without
labels or notes in brackets; a country's နိုင်ငံ is dropped when it
describes. It is labelled as made from the entries, never shown as an entry.

## Myanmar words

Myanmar is written without spaces between words (`shared/query/segment.js`):

1. The text is split at spaces and punctuation (၊ ။), then into syllables. A
   consonant starts a syllable unless it closes the one before (ချစ်, the
   first တ of မေတ္တာ) or is stacked under it.
2. Every run of up to ten syllables is a possible headword; the Worker asks
   the dictionary once which of them are headwords with senses.
3. The reading with the fewest syllables left over, then the fewest words,
   is taken, so the longest headwords win: ချစ်သူရေ → ချစ်သူ · ရေ. Syllables no
   headword covers stay together, marked as not in the dictionary.

On the real word list: ကျွန်တော်မြန်မာစာလေ့လာနေပါတယ် → ကျွန်တော် · မြန်မာ · စာ ·
လေ့လာ · နေ · ပါ · တယ်; ကွန်ပျူတာနည်းပညာ → ကွန်ပျူတာ · နည်းပညာ.

## Display

A headword is always a word as the dataset spells it, never the text
typed: a search for `god` shows `God` and `god` as two headwords, each with
its own timeline. A phrase shows its words this way, each sense that fits
the phrase first with the phrase as its label, and the phrase with its
Myanmar reading in the side panel. How the query was read (a question taken
off, a spelling corrected) is one quiet line above the first headword.

## Not yet

- Zawgyi text detected and converted.
- Headwords of several words found inside a sentence ("look after").
- More phrase patterns, each with its own tests before it is shown.
