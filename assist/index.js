import * as anchor from "./anchor/index.js";

// import * as anchor from "./anchor/index.js";
export { default as wordbreak } from "./wordbreak/index.js";

export const {
	language,
	glossary,
	visits,
	speech,
	thuddar,
	search,
	grammar,
	env
} = anchor;

export const docket = anchor.json;
export const { translation, definition, suggestion, query } = anchor.clue;
export const config = anchor.env.default;
