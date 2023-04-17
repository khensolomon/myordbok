import { env } from "../anchor/index.js";

const { gistId, gistToken } = env.config;
/**
 * @param {any} req
 */
export default async function test(req) {
	// return req
	return `id:${gistId} token:${gistToken} name:${req.params.name}`;
}
