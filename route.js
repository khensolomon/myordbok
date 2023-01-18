// import core from 'lethil';
import "./routes/home.js";
import "./routes/about.js";
import "./routes/grammar.js";
import "./routes/fonts.js";
import "./routes/dictionary.js";
import "./routes/definition.js";

import "./routes/privacy.js";
import "./routes/terms.js";
import "./routes/api.js";

/**
 * NOTE: development only
 */
// import './routes/db.js';
// import './routes/template.js';

// core.route('navTMP','/template').get({url: '/template',route: 'template', text: 'Design'})
// core.route('navAPI','/api').get({url: '/',route: 'api', text: 'API'});

// core.route('navDictionary','/dictionary').get({url: '/:id?',route: 'dictionary', text: 'Dictionary'});
// core.route('navDefinition','/definition').get({url: '/',route: 'definition', text: 'Definition'});

// const navTerms = core.route('navTerms');
// navTerms.get({url: '/privacy',route: 'privacy', text: 'Privacy'});
// navTerms.get({url: '/terms',route: 'terms', text: 'Terms'});

// const navPage = core.route('navPage','/');

// navPage.get({url: '',route: 'home', text: 'Home'});
// navPage.get({url: '/about',route: 'about', text: 'About'});
// navPage.get({url: '/grammar',route: 'grammar', text: 'Grammar'});
// navPage.get({url: '/myanmar-fonts',route: 'fonts', text: 'Fonts'});

// app.Navigation('navDictionary')
//   .route({url: '/dictionary/:id?',route: 'dictionary', text: 'Dictionary'});

// const {Navigation} = require('.');
// const app = require('.');

// app.Navigation('navAPI')
//   .route({url: '/template',route: 'template', text: 'Design'})
//   // .route({url: '/test',route: 'test'})
//   .route({url: '/api',route: 'api', text: 'API'});

// app.Navigation('navDictionary')
//   .route({url: '/dictionary/:id?',route: 'dictionary', text: 'Dictionary'});

// app.Navigation('navDefinition')
//   .route({url: '/definition',route: 'definition', text: 'Definition'});

// app.Navigation('navTerms')
//   .route({url: '/privacy',route: 'privacy', text: 'Privacy'})
//   .route({url: '/terms',route: 'terms', text: 'Terms'});

// app.Navigation('navPage')
//   .route({url: '/',route: 'home', text: 'Home'})
//   .route({url: '/about',route: 'about', text: 'About'})
//   .route({url: '/grammar',route: 'grammar', text: 'Grammar'})
//   .route({url: '/myanmar-fonts',route: 'fonts', text: 'Fonts'});

// app.Navigation('navFallback')
//   .route({url: '*',route: 'home', text: 'Fallback'})
