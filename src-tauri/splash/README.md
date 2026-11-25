# The apps' splash

What iOS and Android show while the app starts: the MyOrdbok logo in the
middle, "Myanmar dictionary" near the bottom, on the app's own ground. Light
or dark with the phone: at night the logo takes calmer colours
(`logo-dark.svg`: a deeper blue, a dimmer grey) and the ground is the app's
dark one, so nothing bright shows in a dark room.

| | Light | Dark |
|---|---|---|
| Ground | `#f2f4f7` (the app's `--grouped`) | `#0d1116` |
| Label | `#5b6573` | `#7a8594` |
| Logo | `logo.svg` | `logo-dark.svg` |

The colours live in `scripts/splash.js` (`COLOURS`), the one place to change
them.

## What is here

- `logo.svg`, `logo-dark.svg`: the logo, light and dark (the website's
  `app/static/logo.svg`; the dark one in calmer colours). The app's build
  also draws them into its page (`scripts/build.js`, `appSplash`).
- `ios/LaunchScreen.storyboard`: the launch screen. The logo 220 points wide
  in the middle; the label 24 points above the safe area's bottom.
- `ios/Assets/`: the logo at 1x, 2x and 3x, light and dark.
- `android/res/`: at xxxhdpi, light and night:
  - `splash_icon.png`: Android 12 and later draw their own splash with an
    icon in the middle, inside a circle 192 dp across; the logo, 176 dp wide,
    fits it.
  - `splash_brand.png`: the label, Android 12's branding image (200 × 80 dp).
  - `splash_logo.png`: the logo alone, for the window background that is the
    splash on Android before 12.

## How it gets into the apps

The native projects are made fresh by the CI (`tauri ios init`,
`tauri android init`); after them, `node scripts/splash.js install ios|android
--apply` puts these in:

- iOS: the storyboard over the template's, the logo set and the two named
  colours into `Assets.xcassets`.
- Android: the pictures, the colours (`values`, `values-night`), the window
  background (`drawable/splash_window.xml`) and the splash items into the
  app's theme, light and night.

The page then carries the splash on until the first page is drawn: the app's
build puts it into `index.html` with the logo drawn in the page (no file to
wait for), and `app/main.js` fades it.

## Changing the logo or the colours

```
npm i -g playwright
PLAYWRIGHT="$(npm root -g)/playwright/index.mjs" node scripts/splash.js render --apply
```

and commit the pictures.
