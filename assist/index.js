import * as anchor from "./anchor/index.js";

// import * as anchor from "./anchor/index.js";
export { default as wordbreak } from "./wordbreak/index.js";

export const { language, glossary, visits, speech, thuddar, search } = anchor;
export const { translation, definition, suggestion } = anchor.clue;
export const config = anchor.config;
