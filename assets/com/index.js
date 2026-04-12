// NOTE: favicon
// import '../img/favicon.ico';
// import '../img/apple-touch-icon.png';
// import '../img/android-chrome-192x192.png';
// import '../img/android-chrome-512x512.png';
// import '../img/favicon-32x32.png';
// import '../img/favicon-16x16.png';
import '../img/app.webmanifest';
import '../img/robots.txt';

// NOTE: icons for manifest and other uses
import "../psd/icon.svg?as=favicon&w=32&format=ico";
import "../psd/icon.svg?as=favicon&w=32&format=png";
import "../psd/icon.svg?as=logo-16x16&format=png";
import "../psd/icon.svg?as=logo-32x32&format=png";
import "../psd/icon.svg?as=logo-192x192&format=png";
import "../psd/icon.svg?as=logo&w=60&format=png";
import "../psd/icon.svg?as=logo-512x512&format=png";

// NOTE: apple-touch-icon
import "../psd/icon.svg?as=apple-touch-icon&format=png";
// import "../psd/icon.svg?as=icon-reszied-250&w=250";

// NOTE: logo
// import "../psd/logo.svg?as=logo&w=600&format=png";
// import "../psd/icon.svg?as=MyOrdbok&w=250&format=png";

// NOTE: icons && loader animation
import '../icon/animation.css';
import '../icon/myordbok.css';

// // NOTE: layout and design
import '../scss/style.scss';

// NOTE: serviceWorker
// We removed sw.js and data-worker.js imports. They are now built as separate 
// files via webpack entries. sw.register.js can remain here if you want the 
// registration logic to run as part of the main UI thread.
// import '../script/sw-register.js';

// NOTE: script
import '../script/index.js';
// import exec from '../script/test.js';