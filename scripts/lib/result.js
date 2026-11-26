// @ts-check
/**
 * What a tool command found, for the workspace's Tools (shared/commands.js):
 * a script run by scripts/run.js writes it as JSON to the file TOOL_RESULT
 * names; run.js then puts it on the run as an annotation, which GitHub
 * serves to anyone who may read the repository, and the workspace reads it
 * from there. Without TOOL_RESULT (a script run by hand) nothing is written.
 */
import { writeFileSync } from 'node:fs';

/** @param {object} data */
export function result(data) {
	const file = process.env.TOOL_RESULT;
	if (file) writeFileSync(file, JSON.stringify(data));
}
