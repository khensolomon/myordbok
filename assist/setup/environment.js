import { deploy } from "lethil";

/**
 * Purely for deployment from local/workspace
 * @alias deploy.environment
 * @param {any} req
 */
export default function transferEnvironment(req) {
	const env = "~/OneDrive/env/dev/myordbok/web/.env";
	return deploy.environment.transfer(env);
	// return deploy.environment.buildCommandLine(env);
}
