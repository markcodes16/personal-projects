import { env } from "cloudflare:workers";
export function storeDb() { if (!env.DB) throw new Error("Training storage unavailable"); return env.DB; }
