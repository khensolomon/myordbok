import { ask } from "lethil";
import { env } from "../anchor/index.js";

const { gistId, gistToken } = env.config;

export const gist = new ask.gistData({ id: gistId, token: gistToken });
