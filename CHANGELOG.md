# Changelog

## 26.11.22+172

- Smoother scrolling on phones; the search screen stays below the status bar; the app opens on home

## 26.11.22+171

- App: haptic taps, no scrollbar, native touch feel

## 26.11.22+170

- Definition bar with Back and the entry's thumb; pages slide in; back swipe in the iOS app

## 26.11.22+169

- New look by screen size: tab bar and sidebar, You and Liked, search as its own screen

## 26.11.22+168

- Link the app to an account through the website

## 26.11.22+167

- Sign in with Apple on the website, removable: its own module and setting (on, existing accounts only, off), Add another way to sign in for Apple-only accounts, and Members filtered by Apple only

## 26.11.22+166

- The app's icon: the M on a full blue square, opaque as the App Store requires

## 26.11.22+165

- App workflow: the iOS app, signed through the App Store Connect API key and uploaded to TestFlight

## 26.11.22+164

- App workflow: the Tauri CLI as a devDependency, which the Android project calls back into

## 26.11.22+163

- App workflow: a Play bundle signed with the upload key, beside the test APK

## 26.11.21+162

- The MyOrdbok app (Tauri) for iOS and Android: the app's adapters, the API's way in for the app, an update asked for below APP_MIN, and an Android test build in GitHub Actions

## 26.11.21+161

- Searches: the CSV holds every column or the word alone

## 26.11.21+160

- Overview: meanings rated down most wrap within their card, as plain text

## 26.11.20+159

- Ratings, Questions and Votes in three columns like Members: the list, the item with its entry as the dictionary has it now, and its actions; a lighter gear for Settings

## 26.11.20+158

- Every related word links, those without an entry in a lighter colour; sign-in addresses are new each time; Settings has a gear icon

## 26.11.19+157

- A release no longer breaks pages left open: a missing file is a 404, never the app page; the service worker keeps the release before and refuses a page cached as a file; a script that fails to load reloads the page once

## 26.11.19+156

- The cutover command and the earlier site's notes are gone; a bad live version is put back from the Worker's deployments

## 26.11.19+155

- Scripts and documentation checked: dataset-sync holds the dataset's lookup to what the app needs; docs describe the site as it runs

## 26.11.19+154

- No entry: the nearest meanings as wide as the rest of the page

## 26.11.19+153

- No entry: “not a word we know yet”

## 26.11.19+152

- No entry says what kind it is: a recognised word not yet defined, a likely misspelling (Did you mean …?, or marked by editors), or not a word MyOrdbok knows; Myanmar slips find the word meant; invisible characters are taken out of every search

## 26.11.19+151

- No entry: the English words around the word in full (synonyms, similar, broader, opposite, related), as an entry lists them

## 26.11.19+150

- Lookup from dataset 1f3373b: a word without an entry shows its nearest Myanmar meaning (same as, similar to, a kind of); related words link only when they have an entry

## 26.11.19+149

- Searches: periods of today, 3 and 5 days. Members: seen in the last 24 hours, 3 days or a week; sort by offline downloads or devices. No entry: the words around it from WordNet and Moby, with their Myanmar meanings, and the words searched most

## 26.11.19+148

- Test yourself: listen, type the word and which meaning; rounds mix the kinds. Home: word of the day with Test yourself on it and Share, and the daily round (migration 0020)

## 26.11.19+147

- Test yourself progress follows a signed-in member to every device (merged on each save); Practice shows answers that helped the dictionary (migration 0019)

## 26.11.19+146

- Help the dictionary: after a round, signed-in members answer spelling and meaning questions; check questions decide whose votes count; the workspace's Votes shows items ready to decide (migration 0018)

## 26.11.19+145

- Test yourself: report a question; answers counted per question with the reader's consent; the workspace's Questions lists reports and often-missed questions (migration 0017)

## 26.11.18+144

- Account menu: Sign out moves beside the account name; the page links no longer wrap

## 26.11.18+143

- Test yourself and Comments: the heading runs into a rule to the right, with more space between the meanings, the quiz and the comments

## 26.11.18+142

- Test yourself hidden on a device keeps its heading with a Show button; a cached site answer without the quiz switch no longer hides it

## 26.11.18+141

- Test yourself laid out like Comments: full width of the entry, the round in a bubble from MyOrdbok; one column of choices on narrow screens

## 26.11.18+140

- Test yourself on word pages and a practice page: questions made on the device from reviewed meanings, progress kept on the device

## 26.11.18+139

- Workspace filters: the group that does not fit whole shows the choices that do, the chosen one always among them; the rest go under ⋯

## 26.11.18+138

- A word with meanings of its own that is also a form (loathing, -ing of loathe) says so under that part of speech, in a section of its own when it has no meanings as it

## 26.11.18+137

- Senses read as items: ' | ' between glosses and examples, notes as labels and name–value lines, [en:…] as the sense in English; etymology column gone; suggestions checked against the item rules; ratings follow the glosses

## 26.11.16+136

- Searches and Inbox: Shift and a click on a row selects every row from the open one to it

## 26.11.16+135

- Members: filters by sign-in, joining, last visit, contributions, supporter and statistics; sorting; show more; CSV

## 26.11.16+134

- Inbox: filters by kind, sender, answer and language; search over every message; several messages at once (read, done, thank and close, unread, delete)

## 26.11.16+133

- Searches: labels (to add, misspelling, not a word), more filters, several words at once, near spellings on a word's page

## 26.11.16+132

- Inbox for every member: their own messages with the answers; admins answer from the Inbox with saved answers, or thank and close in one press

## 26.11.16+131

- A form's note (loved: past of love) stands under the part of speech it holds for, lit for a few seconds when first on screen

## 26.11.16+130

- Related words: each kind a label with its words beneath, side by side where there is room; forms on the line of their part of speech

## 26.11.16+129

- A headword can be heard: a button beside it, through /api/pronunciation

## 26.11.16+128

- Phones: side and bottom room for the notch, Dynamic Island and home indicator, in the workspace too; an empty search field lists recent searches on focus

## 26.11.16+127

- Search: ✕ and Escape clear the field and list recent searches, the / hint shows whenever the cursor is elsewhere; comments as cards pointing at the face, a form as tall as the face that grows with its lines

## 26.11.15+126

- The offline copy follows a change of content alone (grammar, icons, fonts), with or without a new version number

## 26.11.15+125

- Cutover: reads LIVE_ENABLED through the API (earlier gh versions); says what Cloudflare's 6003 means

## 26.11.15+124

- Cutover: clearer messages for a badly pasted token and a missing GitHub environment

## 26.11.15+123

- The Myanmar interface is paused for review: English for every reader; ?ui=my turns it on for a reviewer's device

## 26.11.15+122

- Sitemap and robots.txt; the crawler sentence keeps the first 2 meanings of each part of speech; make cutover and cutover-undo

## 26.11.15+121

- The definition page says what it is about before any script runs: a title, a description and one sentence of the first meanings, for search engines and link previews; one address per headword, 404 for no entry, the API's rate limit; the earlier site's addresses redirected

## 26.11.15+120

- Workspace without its footer: the build is named on Overview, the waiting count follows each decision in the list header and the badge; About in the person menu; docs/deploy.md opens with a what-to-do guide for both directions of a dictionary update

## 26.11.15+119

- Sweep: dead code and unused styles and icons removed, colours for danger, warning and success as tokens with dark-mode values, shared text limits, docs brought up to date; fixes: a doubled Myanmar text, names every object has taken for settings or fields, the same new meaning taken twice; the No entry page suggests the word

## 26.11.15+118

- Studio laid out like Suggestions: a list of edited words with filter and search (any dictionary word can be opened), the sheet in the middle, the word's figures and history beside it

## 26.11.15+117

- Studio in the workspace: one word with every meaning on a sheet; change the text, example, part of speech and status, add or remove meanings, and see the word's history

## 26.11.14+116

- Live edits: an edit an admin or owner approves is shown to readers within minutes, laid over the build until the next data release carries it; Make live and Take off the site in Suggestions; a Live edits switch in Settings (migration 0014)

## 26.11.14+115

- Comments on entries: a quiet one-line form beside your face that opens when written in, with Cancel and Ctrl+Enter; an Editor mark on answers from the team; times as 1 h ago or yesterday; the newest five, then Show all

## 26.11.13+114

- Smaller downloads: the build minifies every script and stylesheet (about 30% less to download), with source maps for debugging

## 26.11.13+113

- Beta and live: the dictionary databases become myordbok-beta and myordbok-live, the live site and its Worker live and myordbok-live, in code, commands and docs (migration 0013)

## 26.11.13+112

- Workspace: sections that do not fit go under ⋯ with a count; the phone menu scrolls; a dot on the person button shows online or offline

## 26.11.13+111

- Support page figures: light weight, black on light and white on dark, with a soft neutral glow

## 26.11.13+110

- Support page figures in the logo blue with a matching glow (a lighter blue in dark mode), instead of dark text with a glow

## 26.11.13+109

- Support page: the full available width inside the usual gutters, type that grows with the screen without getting small on phones, a soft logo-blue glow on the figures, and the logo blue on the steps' edge and the closing thank-you

## 26.11.13+108

- Support page uses the available width (up to 1600px) and lays itself out by its own width: four steps and four ways to help side by side on wide screens, two on tablets, one on phones; Give in two columns; thanks in two columns; paragraphs keep a readable line length

## 26.11.13+107

- Support page closes with အားလုံးကို ကျေးဇူးတင်လျက် and “With thanks to everyone who keeps MyOrdbok going.”

## 26.11.13+106

- Settings page works again: the two support settings edited in Sponsors appear as rows linking there, and a test keeps every setting on the page

## 26.11.13+105

- Support page, truthfully: 16 years free (not ad-free); How it came about tells of the advertising years (2012–2015), removed because they got in the way of reading, and readers taking their place; a running-cost line the owner fills in in Sponsors once the figure is known, hidden until then

## 26.11.13+104

- Myanmar fonts page retired: out of the menu, /myanmar-fonts says why with good fonts elsewhere and a way to give feedback; Support page redesigned as something readers keep together: centred hero with the dictionary in figures, how it came about, what gifts pay for, and a closing thank-you in Myanmar

## 26.11.13+103

- make data-release: approved workspace edits through the dataset's own scripts, build and search checks, a diff and one question, then commit, push and beta; the Overview shows editors what waits for a release

## 26.11.13+102

- Home invitation: the owner writes its lines in Sponsors (English and Myanmar, up to 12; setting support.lines), the home page shows a different one each visit, and the line sits centred

## 26.11.12+101

- Support page: Give to MyOrdbok and Other ways to help glide to their part of the page instead of relying on the browser's hash jump

## 26.11.12+100

- Support: a Support page (/support) linked from the header with a heart, About moved to the footer with Contact; a quiet, dismissible line on the home page (Settings: support.ask); supporters and donations kept by the owner in the workspace (Sponsors), shown publicly only as totals and consenting names; the old sponsor files removed from the repository, with make sponsors-import to move them in once

## 26.11.12+99

- How a search was read (typed in Zawgyi, a question taken off) goes above the headword, and beside the entry on wide screens, so the language badge and the timeline stay joined; Myanmar headwords a little smaller

## 26.11.12+98

- Zawgyi: a Myanmar search typed in Zawgyi is read in Unicode (online, offline and in suggestions) and says so; comments, suggestions and messages offer the Unicode of Zawgyi text and the Worker refuses Zawgyi (Google's myanmar-tools detector and converter, Apache 2.0)

## 26.11.12+97

- Weekly backups of the app database to R2 (Worker myordbok-backup, 12 weeks kept), row-by-row restore with make restore, copies off Cloudflare with make backup-pull, and the last backup on the admin Overview

## 26.11.12+96

- Every MyOrdbok file in one private R2 bucket, myordbok; offline packs under offline/

## 26.11.12+95

- A meaning's wordings on their own lines, split by semicolons; notes in round brackets set apart; related words larger on phones

## 26.11.12+94

- Offline copy sealed with a device key; definitions downloads held to a few a day per member; marker entries checker; terms

## 26.11.11+93

- Settings cards look like the Overview's: the same background, corners and shadow

## 26.11.11+92

- Settings use the full width, left aligned, cards in columns

## 26.11.11+91

- Settings group links fit the width, the rest under a menu; no sideways scrolling

## 26.11.11+90

- Settings redesigned: cards of rows with switches, segments and numbers beside their full description; a read-only warning, jump links, and a dot for changed settings

## 26.11.11+89

- Settings: read-only mode, new accounts, suggestions, ratings, comments (hidden too, daily and first-day limits, no duplicates), contact form, search counting and keeping, home list, word lists by themselves

## 26.11.11+88

- Desktop search bar gets a soft shadow once the page scrolls under it

## 26.11.11+87

- Search focus eases in a soft ring; the search button steps back to a plain icon until something is typed

## 26.11.11+86

- The filters menu opens in full instead of clipped by its row

## 26.11.11+85

- List filters fill the column's width, the rest under a menu that goes when all fit; search hints for each list

## 26.11.11+84

- Suggestions and Contributions keep their resize handle

## 26.11.11+83

- List heads: filters and menu on one row, the search box on its own row in the same place everywhere; Inbox search; Contributions status menu

## 26.11.11+82

- Workspace lists share one head: title and count, one line of filters, the rest under a menu; the list column resizes on desktops

## 26.11.11+81

- Searches sort: most searched, last searched, most days, A to Z

## 26.11.11+80

- Phrases, sentences and did-you-mean read offline on the device; releases in two commands (data-beta, data-live)

## 26.11.11+79

- Comments on entries with moderation; statistics shared with chosen members; deleting old search counts; LICENSE holder

## 26.11.11+78

- Overview links each list to its section, only for roles that may open it

## 26.11.11+77

- Searches section for editors (every word, not found first, per word days, CSV); Ratings paged with filters and search

## 26.11.11+76

- Offline use counted in usage_counts (downloads, daily check-in, words answered offline) and shown to editors on the Overview

## 26.11.11+75

- Home lists centred, recent searches removable one by one; smaller ringed account button with the first letter when there is no picture

## 26.11.11+74

- Phone search focus: Cancel replaces the menu row, the entry fades back; clearer search box; contact form linked from About

## 26.11.11+73

- Search bar does not stick while typing on touch screens, so the iOS cursor stays in the field; the redraw attempt removed

## 26.11.11+72

- Search cursor redrawn after the page moves under the sticky field on touch screens

## 26.11.11+71

- Search cursor stays with the field on iOS: no blur behind the field while typing

## 26.11.11+70

- Softer menus: one faint shadow instead of outline, highlight and stacked shadows

## 26.11.11+69

- The home page's logo opens how to search: /definition with no word shows each kind of query with examples to try, and the dictionary in figures

## 26.11.11+68

- Phones: related words and forms a size larger, with more room between lines for tapping

## 26.11.11+67

- Workspace on phones: the top bar is Liquid Glass like the site's header: a floating capsule with the logo and the section's name, the menu button beside it, and the page scrolling under them

## 26.11.11+66

- Workspace on phones: a bar at the top with the section's name and a menu of sections from the button on the right, replacing the bottom bar; plain http is sent to https before sign-in

## 26.11.11+65

- Site notices: admins schedule maintenance, information and celebration notices in the workspace; maintenance and information show as a bar on every page, a celebration on the home page

## 26.11.11+64

- Workspace overview redesigned: cards across the whole width, a greeting, the search chart with this week's change beside the most searched words, and a layout that follows the work area's width

## 26.11.11+63

- The blue bar at the top of every page is gone; a thin bar now shows only while a page takes a moment to load

## 26.11.11+62

- Phones: on the home page the logo steps aside while typing and suggestions stay above the keyboard; forms and related words line up with the meanings; text no longer shows under the search box while scrolling

## 26.11.11+61

- Phones: smaller home logo and a taller search box; lighter outline and shadow on the search box, the header capsule and the person button

## 26.11.11+60

- Person menu stays under its button when the page has a scrollbar

## 26.11.11+59

- Answers laid out like an entry, with copy buttons; forms within their part of speech and related words on the entry's timeline; the home page shows recent searches (kept on the device) and the words searched most this week; README brought up to date

## 26.11.10+58

- Migration 0007 fixed: it failed with FOREIGN KEY constraint failed on any database with members; users and role_grants are now rebuilt from copies under their own names, which keeps every reference

## 26.11.10+57

- make grant: says which migrations to apply when the database does not know the level yet; wrangler's own reason shown when a D1 command fails

## 26.11.10+56

- Owner level above admin: owners give and take every level, admins make members editors; Members section in the workspace with search, levels, suspending and the history of each level

## 26.11.10+55

- Header: one person menu with sign-in or the account, language, theme, usage statistics, the offline copy and Contact; footer slimmer. Workspace: Offline section (word lists keep themselves; definitions on request, removing asks twice); /offline moves there

## 26.11.10+54

- Workspace: Overview for every member (dictionary statistics per build, review progress, parts of speech, labels, searches, community); Ratings section (own ratings, take back; editors: the site's most liked and disliked); Inbox states unread, read, replied, done with admin notes; make data-stats

## 26.11.10+53

- Search: / or Ctrl+K (⌘K) focuses the search field; Contact page points ideas, feature requests and bugs to GitHub issues

## 26.11.10+52

- make data-packs: its own PACKS_OUT, not the OUT of edits-export

## 26.11.10+51

- Offline: word lists kept on the device by themselves; definitions and related words downloaded on the Offline page (members, or everyone by an admin setting); one word's answer and suggestions work without a connection. Packs are made per build (make data-packs) into R2, never read from D1

## 26.11.10+50

- Lookups: similar and broader read only their synsets' links (dataset b861c95); every English lookup read about 113,000 wn_link rows before, a handful now

## 26.11.10+49

- Contact form (/contact) with an admin Inbox in the workspace, replacing the contact email; missing words link to it

## 26.11.10+48

- Myanmar interface: every interface text in Myanmar (app/i18n), language button in the header, the device's language by default, Myanmar digits and dates, parts of speech by their Myanmar names

## 26.11.10+47

- Workspace: Overview board as the home (search counts per word and day, top and missing words, suggestions, members, meanings rated down); signing in and the account moved into the workspace, with account deletion; /account redirects

## 26.11.10+46

- Browsers without Sec-Fetch-Site (Safari before iOS 16.4) can search again: a Referer on the site counts instead
- The search box only lifts and opens when it has suggestions; focus alone outlines it
- Theme switch in the header: device, light, dark; the device's theme by default
- When usage statistics were declined, a chart icon beside the account button allows them in one tap

## 26.11.9+45

- Workspace in studio form: rail, list, work area, inspector and status bar; on phones a bottom bar with list and item in turn
- A suggestion opens as a diff inside its entry as it is now; J and K move through the list, A and D approve or decline
- Contributions grouped by where each stands, with a progress track; Account inside the workspace; no 'My' labels

## 26.11.9+44

- The studio is now the workspace, at /workspace, shared by every member; its API moves to /api/workspace

## 26.11.9+43

- Studio: editors review waiting suggestions against the dictionary as it is now, approving or declining with a note
- Studio: every member sees their own suggestions with status and reviewer's note, and can withdraw one while it waits
- The account page links to the studio

## 26.11.9+42

- A rating that cannot load says so instead of sending a signed-in reader to the sign-in page and back

## 26.11.9+41

- Each meaning has its own thumbs up and down and a suggest button that edits only that meaning, right under it
- The side card rates the entry as a whole and adds a missing meaning; thumbs replace the heart icons
- A meaning's ratings start afresh when the meaning is corrected
- Lookups carry each sense's id (dataset search code synced)

## 26.11.9+40

- Signed-in members like or dislike an entry and suggest changes to its meanings, a new meaning, or removing one, from the entry page
- A member's suggestion waits for review; an editor's own is approved and reaches the dictionary with the next release
- After signing in from an entry, the reader comes back to that entry

## 26.11.9+39

- A sign-in provider that is not set up names the missing setting on the account page

## 26.11.9+38

- About explains sign-in: what is kept, why, and a link to Privacy

## 26.11.9+37

- Local sign-in works from the dev server on :8000: the callback is always localhost:8787

## 26.11.9+36

- Local GitHub sign-in uses the same GitHub app as beta and production

## 26.11.9+35

- Sign in with Google or GitHub: the account page, the account button in the header, sign out
- The same verified email through either provider is the same member; unverified emails are neither stored nor matched
- make grant gives a member a role by their sign-in email

## 26.11.9+34

- Refused API requests get the standard message 'Access denied.'

## 26.11.9+33

- The production Worker is named myordbok; the local-only configuration is myordbok-local, so a deploy without --env can never overwrite production

## 26.11.9+32

- The API answers the app's own pages only: other websites and scripts are refused on beta and production
- Rate limits per visitor, stricter for the routes that read many rows; repeated lookups come from the edge cache

## 26.11.8+31

- One request decides what a query is: an entry, a phrase, a sentence or nothing found, so a slow connection waits once
- Myanmar text written without spaces is split into the dictionary's headwords and shown one word at a time; syllables no headword covers are marked
- Punctuation around a single word no longer hides it (love!, ချစ်။)

## 26.11.8+30

- Each spelling the dataset holds is its own headword: a search for 'god' shows God and god separately
- A phrase shows its words as headwords, the sense that fits first and marked; the phrase and its Myanmar reading move beside them

## 26.11.8+29

- Phrases that are not entries, such as 'king of Denmark' or 'big house', are read from their words: the Myanmar of the whole phrase, then the sense of each word that fits
- More questions understood: who is, where is, what does X mean, how do you say X in Myanmar, X in Burmese
- docs/query.md: how a query is read, and what is shown for each kind

## 26.11.8+28

- Search reads what was typed first: numbers in Myanmar and English words, sums and percentages, the time and date answered on the device
- Questions such as 'what is love' or 'similar word of love' open the word, saying how the question was read
- No entry: did you mean, words starting the same way, and a way to suggest the word; sentences shown one word at a time

## 26.11.8+27

- Terms: MyOrdbok is a free, non-commercial service for general information; use is personal, educational and non-commercial, as in the previous terms

## 26.11.8+26

- Terms of Use rewritten for the new app: a short summary; free use for study, teaching, work and personal purposes; quoting with credit welcome, bulk copying, scraping and sharing the offline download not; WordNet and Moby Thesaurus under their own terms; the MIT licence covers the code only; accuracy and draft meanings; accounts and contributions (licence to publish, editor review, removal of abuse); Myanmar fonts; liability; how to report a problem
- The contact address placeholder and the repository link live in one place (app/core/config.js) for the About, Privacy and Terms pages

## 26.11.8+25

- Header links quieter on wider screens: no capsule, the current page under a barely-there pill and an even paler hover, both still gliding; phones keep the icon capsule

## 26.11.8+24

- Header links in a glass capsule on every screen size: a raised lens marks the page you are on and glides to the new link when the page changes; a light tint follows the pointer from link to link
- A thin brand-blue bar across the top of every page

## 26.11.8+23

- Myanmar text uses Noto Sans Myanmar with true regular and semibold weights (SIL Open Font License, shipped with the app) instead of Myanmar3, whose bold was faked by the browser; about the same size to download
- Grammar: terms being explained get a soft blue highlight instead of bold
- Grammar terms without a section of their own show as chips like the others

## 26.11.8+22

- Grammar topics: a back button before the title replaces the Grammar link; opened from the list it returns to the list where it was left, otherwise it opens the list
- Back and forward put every page back where it was scrolled to

## 26.11.8+21

- Grammar pages: /grammar lists the nine parts of speech and the other topics with their Myanmar and English names; /grammar/<slug> shows a topic's sections, classifications (linked to their sections), example words, example sentences and tables, with the contents beside the text on wide screens and above it on phones, and previous/next topics
- Grammar content is built from assets/data/thuddar into /data/grammar/ and kept for offline use; malformed data stops the build with the file named; the English parts of speech appear on the part-of-speech topic
- About page rewritten with current information: the name, live figures and last update from the dictionary in use, how meanings are checked, aim, how the dictionary grows, how to help (GitHub issues until sign-in), support (PayPal, GitHub Sponsors), the running version explained, and sources (WordNet, Moby Thesaurus, မြန်မာသဒ္ဒါ); visit counts, the language list, social sharing, Google Forms and outdated notes removed
- /api/health also returns the dictionary's row counts; links to a place on the same page (#…) scroll there, also when opened directly

## 26.11.8+20

- Suggestion rows are square under the hairline; only the last row rounds, at the bottom, inside the box's corners
- Open suggestions: the box turns opaque so the page behind never shows through the list; glass again once closed

## 26.11.8+19

- Suggestion highlight follows the box: the first row rounds at the top, the last at the bottom, rows between are square

## 26.11.8+18

- Open search box: no fill behind the field; a hairline separates the field from the suggestions

## 26.11.8+17

- Focused search box: a lifting shadow instead of a blue line

## 26.11.8+16

- Search box: closed it is a pill; on focus the whole box grows 4 px outward and its corners ease to 20 px around the field's 16 px (concentric), with the button always a circle and the text never moving

## 26.11.8+15

- Definition pages: larger logo (180 px) and icon (40 px) beside the search box
- Below desktop, the header and the search bar have no bottom line; once the page scrolls under the search bar, a soft, partly transparent shadow lifts it
- Phones (Liquid Glass): the header and the search bar float without a band; the nav capsule, You button and search box carry their own glass, and a fading scrim appears behind them only once the page scrolls
- Definition pages get a second column on large screens (below the entry on smaller ones): a summary of the result (meanings, parts of speech, what is still a draft or awaiting review) and a place to like, dislike or suggest a correction, disabled until sign-in arrives
- New dislike icon in the same line style

## 26.11.8+14

- Large screens: each part of speech's line starts under the left edge of the search box, and the word lists line up with it; the outer line stays under the language badge
- Fix: a stray brace in app.css dropped the word-list styles; a test now checks every stylesheet for balanced braces

## 26.11.8+13

- The definition timeline's line runs down from the middle of the language badge again; the word lists start on the same line
- Side padding of header, search bar, content and footer grows with the window: clamp(16px, 2.5vw, 48px)

## 26.11.8+12

- The search bar shows only on the home and definition pages
- A definition is as wide as the logo and the search box; its timeline and word lists start under the left edge of the search box and follow it as the screen narrows
- Logo by screen size: full logo on desktop, the icon on tablets and large phones, none beside the search box on phones (the home page keeps the full logo above it)
- Phones: the main links become icons (home, grammar, fonts, about) in a glass capsule, the current page under a brighter lens
- Liquid Glass on the header, the footer, the search bar and the search box: blurred tinted fill, bright top edge, soft lift

## 26.11.8+11

- Home: the logo and the English ⇄ မြန်မာ line above the search box again, centred
- Header and footer span the full width; the search bar and the page content start at the left edge with a reading width; no rule above the footer
- Search box: focusing it shows the suggestions for the word already in it (on a definition page, the word looked up), the same as typing it

## 26.11.8+10

- Header: plain text navigation (Home, Grammar, Fonts, About) that scrolls away; no logo and no empty space for one on the home page
- One search bar for every page, in the page shell: the logo on its left (the icon alone on phones), sticky under the header while the page scrolls; on the home page it is the centrepiece
- Search box: lower (44 px), its background follows rest, hover and focus; a smaller search button inside it; suggestions open inside the same box instead of a separate panel
- Header, search bar, content and footer share one column and one left edge; the footer is a left-aligned line of text without the icon

## 26.11.8+9

- Databases renamed, each with one fixed role: myordbok-app (APP: members, reactions, comments, studio edits), myordbok-dataset (DATASET: every new build lands here; beta previews it) and myordbok-dictionary (DICTIONARY: what production readers get). They replace myordbok, myordbok-dict-a and myordbok-dict-b
- Releases in two steps: make data-publish (build → myordbok-dataset, checked, beta) and make data-promote (the same build → myordbok-dictionary; production reads myordbok-dataset meanwhile, so readers never wait). A promotion that stops part way leaves production on the dataset and blocks new publishes until it is finished
- make data-setup creates all three databases if missing and writes their ids; make data-switch SITE= TO=dataset|dictionary is kept for repairs; rollback is a release of the previous build, or D1 Time Travel on myordbok-dictionary
- dict_release records reads (dataset or dictionary) and build per site; the Worker binding DB is now APP, DICT_SLOT is now DICT_DB, and /api/health names the database in use
- Edits export against myordbok-dictionary and wait while beta previews a build that is not promoted yet
- Docs updated: deploy guide (databases, dictionary releases, studio edits), architecture, Makefile help, wrangler.toml and migration comments

## 26.11.8+8

- Fix: a test assumed wrangler.toml still had placeholder dictionary ids

## 26.11.8+7

- An empty dictionary slot answers 503 with how to fill it (locally make data-sample or make data-local, remotely make data-publish) instead of a raw SQL error

## 26.11.8+6

- make data-setup creates the dictionary databases (or finds them) and writes their ids into wrangler.toml for every environment; data commands also refuse ids that are not UUIDs

## 26.11.8+5

- Data commands stop before contacting Cloudflare while wrangler.toml still has placeholder database ids for the dictionary slots, and say how to fix it

## 26.11.8+4

- Dictionary data now comes from the private dataset build (khensolomon/lai, branch dataset), the TSV files staying the source of truth; the app never writes to the dictionary tables
- Two dictionary slots (D1 myordbok-dict-a and myordbok-dict-b): a release is imported into the free slot, checked against its row counts, then switched to; switching back is the rollback (make data-publish, data-switch, data-status)
- Studio edits get their own table, dict_edits (pending, approved, exported, merged or conflict); make edits-export writes approved edits as the dataset scripts' patch files and turns stale edits into conflicts
- App database schema rewritten as assets/db/migrations/0001_app.sql: members, identities, sessions, role grants, reactions, comments, dict_edits, dict_exports, dict_release; reactions and comments name headwords by spelling
- Database files moved under assets/db/; seed.dev.sql is a made-up sample in the real tables (make data-sample, make data-local FILE= for a real build on your machine)
- The Worker runs the dataset's own lookup (shared/search, kept in step by make dataset-sync): /api/lookup and /api/suggest replace /api/search and /api/entry; /api/health reports the dictionary in use
- Definition page shows the full result: senses by part of speech with draft and awaiting-review badges, a root's entry under its forms (went, go), spelling variants, forms, synonyms, similar, broader, opposite and related words, Myanmar pronunciation, and the dataset markup (labels, patterns, highlights)
- Fix: Myanmar headwords no longer break at large sizes
- Tests run the Worker and the release tool against node:sqlite with the real migration and the sample; Node 22.13 or later

## 26.11.8+3

- Fix: make api and npm run dev:api build dist/web first, so a fresh clone starts without the missing assets directory error

## 26.11.8+2

- Cloudflare setup: beta (beta.myordbok.com, noindex) and production Wrangler environments sharing the D1 database; deployment guide in docs/deploy.md
- GitHub Actions: test every push and pull request; deploy dev to beta; deploy master to production once PRODUCTION_ENABLED is set
- Makefile with commented commands; remote and release commands are dry runs unless APPLY=1
- Google Analytics (G-E74XPBN0S9), loaded only after consent and only on myordbok.com and beta
- Privacy page, including a control to change the analytics choice

## 26.11.7+1

Rewrite begins: the Django version is replaced by an HTML5 app (PWA) on
Cloudflare Workers and D1, in plain JavaScript modules with JSDoc.

- Remove the Django app, Docker setup, deploy workflows and the previous
  front end (`assets/com`, `icon`, `img`, `queries`, `script`, `scss`)
- Add the app shell: router with deep links, search with live suggestions,
  definition page (timeline on wide screens, cards on phones), light and dark
  theme, Myanmar3 web font shipped with the app
- Add PWA manifest, app icons and a service worker that keeps the shell
  available offline; the studio is never precached
- Add platform adapters (`app/platform/web`), with `app/platform/tauri`
  reserved for desktop and mobile builds
- Add the Worker API: `/api/health`, `/api/search`, `/api/entry/:lang/:word`
- Add the D1 schema: dictionary tables, members and roles, sessions,
  change log, reactions (like / dislike), suggestions and comments
- Add stdlib-only scripts: build (hashing, import map, precache), dev server,
  version bump with dry run
- Add tests on Node's built-in runner
- Version scheme is now `yy.mm.dd+changes`

## Previous version (Django)

### 1.9.7

- Introduce <> in instead of [list:*]
- Update dependencies

### 1.9.6

- add antonym & anth-class
  - Provided by `view_antonym`

### 1.9.3-4-5

- Update dependencies
- Add prepare environment for `.env` & `package.json`, calling `environment()`

### 1.9.1-2

- ThemeMode [auto, light, dark]
- Suggestion on non-definition
- Fonts counter db integrations & robot JSON generator

### 1.9.0

- Improved performance, rewrite data-structure
- Todo
  - [ ] oem word source and its relative langs

### 1.8.2-3-4-5-6-7

- NEN
- Cookie consent
- devtool remove on production
- Animation
  - [x] word progress
- Color
  - [x] Theme mode (light and dark)
- TypeOf
  - [x] type (law, medical, physic, religion, grammar, biology, dated etc)
- SEO
  - [x] headings
- Add suggestion
  - [x] form link
  - [x] soundex
- Modified info(data)
- Privacy policy, Terms of service and Cookie policy are updated
  - [x] cookie SameSite=Lax
- Style (search)
  - word: 59652
  - sense: 101876
  - usage: 55418

### 1.8.1

- MED
- Theme mode
- js interactive with vue (component)
- Authentication (firebase)

### 1.8.0

- Move thuddar and glossary.info to rep
- Improved flat, gist, orth, sea, setup, sqlite, thuddar, wordbreak
- Move  to rep
- Fixed thuddar section
- Update time of individual dictionary

### 1.7.9

- Customized input form for mobile
- Update dependencies
- Add list_cache
- Change file.cache directory

### 1.7.8

Font noticed

Glossary

- word: 58845
- definition: 100855
- example: 54138

### 1.7.7

testing

### 1.7.6

Package

- myanmar-notation: 1.5.1
- mathjs: 11.6.0
- word-thesaurus: 1.0.2

Glossary

- usage: 87.5
- completion: 69.3
- word: 58521
- definition: 100485
- example: 53829

### 1.7.0

Package

- pug: 3.0.2
- myanmar-notation: 1.4.5
- mathjs: 9.2.0

Glossary

- usage: 87.5
- completion: 69.2
- word: 58505
- definition: 100472
- example: 53807

### 1.6.3

Package

- pug: 3.0.2
- myanmar-notation: 1.4.5
- mathjs: 9.2.0

Glossary

- usage: 87.5
- completion: 69.2
- word: 58541
- definition: 100480
- example: 53738

### 1.0

Feature

- album
- artist
- queue
