import * as anchor from "./anchor/index.js";

// import * as anchor from "./anchor/index.js";
// export { default as bude } from "./bude/index.js";
export { default as wordbreak } from "./wordbreak/index.js";

export const { language, visits, speech, grammar, seed } = anchor;

export const { translation, definition, query } = anchor.seed;
export const config = anchor.env.default;
