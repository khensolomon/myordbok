import { deploy } from "lethil";

/**
 * Purely for deployment from local/workspace
 * @alias deploy.ecosystem
 */
export const createOrUpdate = deploy.ecosystem.createOrUpdate;

/**
 * Purely for deployment from local/workspace
 * @alias deploy.environment
 * @param {any} req
 */
export function transferEnvironment(req) {
	const env = "~/OneDrive/env/dev/myordbok/web/.env";
	// deploy.environment.transfer(env);
	return deploy.environment.buildCommandLine(env);
}
