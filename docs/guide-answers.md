# Answers

Questions editors ask, answered in a few lines. The workspace's Guide
(`app/workspace/guide.js`) and the search box read this file like any other
doc, with one difference: a heading here is a question as an editor would
put it, and a question that matches one counts double
(`shared/guide/index.js`, `ANSWERS_FILE`). So the answer written here is
found before a chance of the same words elsewhere.

Writing one: a `##` heading with the question, then the answer in plain
sentences, each one standing on its own (an answer is shown sentence by
sentence). Name the section the answer rests on in the last line, as
"See: file › heading". A question sent from the Guide to the Inbox is
answered by adding it here and releasing.

## How do I write a sense, and what separates the items?

Every text column holds items separated by ` | ` (a pipe with a space each side).
A semicolon and a comma are punctuation inside an item and never separate items.
An item that is exactly one bracket is a note, not a gloss: `[figurative]` is a label shown before the glosses, `[compare:…]` or `[Pali:…]` a name and its value shown after them.
In an English headword's sense, `[en:…]` is the sense explained in English, shown under it.
Every other item is a gloss or an example, one to a line in the editor.
See: architecture.md › A sense is read as items.

## How do I mark the headword inside an example?

Write `~` where the headword goes: the reader shows the headword in its place, and the example stays right when the word is renamed.
Write `(-word-)` around the word an example is about to have it highlighted.
See: shared/markup.js, the dataset's Readme › Sense markup.

## How do I link to another word from a sense?

Write the word in angle brackets: `<word>`; several words as `<a/b/c>`, each one a link.
Labels whose value names other headwords link by themselves: `[also:a/b]`, `[see:x]`, `[compare:x]`, `[US:color]`, `[eg:…]`.
See: shared/markup.js.

## Which suggestions does the build refuse?

A `;` between glosses, a pipe without its spaces, unbalanced brackets, and `[en:…]` written before the glosses are refused when the suggestion is made, since the dataset's build would refuse them later.
See: architecture.md › A sense is read as items.

## When does a rating stay with a meaning after an edit?

A rating holds while the glosses stay the same.
The notes, the English explanation and the separator are not the meaning, so changing those keeps the ratings.
See: architecture.md › A sense is read as items; worker/lib/meaning.js.

## How do I change a word's meanings in the workspace?

Workspace › Studio lists the words that have edits, and searching it adds the dictionary's own words, so any word can be opened.
A word opens with every meaning on a sheet: part of speech, status or label, text and example can be changed, a meaning removed, a new one added.
Save sends each change as an edit, reviewed like the ✎ form's on an entry.
See: deploy.md › The studio.

## Why is my change to a meaning refused in the studio?

A meaning that already has an approved change waiting for the release cannot take another: the two would be in conflict.
An admin can make the waiting one live, or the release can be run; then the meaning takes changes again.
See: deploy.md › The studio.

## When do readers see an approved edit?

An edit approved by an admin or owner is live within a few minutes, laid over the build as the entry is read.
An edit approved by an editor waits for the next release, unless an admin presses Make live.
At most 2,000 edits are live at once; a release empties the layer.
See: deploy.md › Live edits; architecture.md › Live edits over the build.

## How do I add a new Myanmar headword?

A new Myanmar headword needs its pronunciation and is added in the dataset, not from the studio.
Ask in the Inbox with the word and its pronunciation (IPA or MLC).
See: deploy.md › The studio.

## How do I run the tests?

`npm test` runs every test under tests/ (`make test` does the same).
One file alone: `node --test tests/guide.test.js`.
See: README.md.

## What is the beta site for?

beta.myordbok.com is the permanent test site: every push to `dev` deploys there, and every dictionary build lands there first for a look before it is promoted to live.
See: deploy.md › Deploying to Cloudflare.

## How does a change reach live?

Code: `make release APPLY=1` fast-forwards master to dev, and GitHub deploys live after approval.
The dictionary: `make data-beta FILE=… APPLY=1`, check beta, then `make data-live APPLY=1`.
See: deploy.md › Branches and releases; deploy.md › Dictionary releases.

## Where do questions from the Guide go?

Send to Inbox sends the question as a message, read in Workspace › Inbox.
The answer is written into docs/guide-answers.md and released; the Guide then finds it first.
See: app/workspace/guide.js.
