import { now } from "./time";

const LINK_TTL = 15 * 60;

/** One-time sign-in links and browser sessions. Only SHA-256 hashes of tokens are stored. */
export class Sessions {
	constructor(private sql: SqlStorage) {
		sql.exec(`CREATE TABLE IF NOT EXISTS tokens (
			hash TEXT PRIMARY KEY,
			kind TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			expires_at INTEGER NOT NULL
		)`);
	}

	/** Creates a sign-in link token valid for 15 minutes. */
	async createLink(): Promise<string | null> {
		const [token, hash] = await newToken();
		const t = now();
		this.sql.exec("INSERT INTO tokens VALUES (?, 'link', ?, ?)", hash, t, t + LINK_TTL);
		return token;
	}
}

/** Returns a random 32-byte base64url token and its hash. */
async function newToken(): Promise<[string, string]> {
	const bytes = crypto.getRandomValues(new Uint8Array(32));
	const token = btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
	return [token, await sha256(token)];
}

async function sha256(s: string): Promise<string> {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
	return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
