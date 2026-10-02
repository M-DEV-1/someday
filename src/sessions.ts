import { DAY, now } from "./time";

const LINK_TTL = 15 * 60;
const SESSION_TTL = 400 * DAY;
const LINK_GAP = 60;
const LINKS_PER_DAY = 10;

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

	/** Creates a sign-in link token valid for 15 minutes. Returns null if a link was made in the last minute or 10 were made in the last day, which caps how much mail a stranger can trigger. */
	async createLink(): Promise<string | null> {
		const [token, hash] = await newToken();
		const t = now();
		const { n, latest } = this.sql
			.exec<{ n: number; latest: number | null }>("SELECT COUNT(*) AS n, MAX(created_at) AS latest FROM tokens WHERE kind = 'link' AND created_at > ?", t - DAY)
			.one();
		if (n >= LINKS_PER_DAY || (latest ?? 0) > t - LINK_GAP) return null;
		this.sql.exec("INSERT INTO tokens VALUES (?, 'link', ?, ?)", hash, t, t + LINK_TTL);
		return token;
	}

	/** Uses up a sign-in link token. Returns a new session token, or null if the link is unknown, expired or already used. */
	async redeemLink(link: string): Promise<string | null> {
		const linkHash = await sha256(link);
		const [token, hash] = await newToken();
		const t = now();
		const used = this.sql.exec("UPDATE tokens SET expires_at = 0 WHERE hash = ? AND kind = 'link' AND expires_at > ?", linkHash, t).rowsWritten;
		if (!used) return null;
		this.sql.exec("INSERT INTO tokens VALUES (?, 'session', ?, ?)", hash, t, t + SESSION_TTL);
		return token;
	}

	async isValid(session: string): Promise<boolean> {
		const hash = await sha256(session);
		return this.sql.exec("SELECT 1 FROM tokens WHERE hash = ? AND kind = 'session' AND expires_at > ?", hash, now()).toArray().length > 0;
	}

	async end(session: string): Promise<void> {
		this.sql.exec("DELETE FROM tokens WHERE hash = ? AND kind = 'session'", await sha256(session));
	}

	/** Deletes tokens that expired more than a day ago. Recent links are kept so the daily limit still counts them. */
	prune(): void {
		this.sql.exec("DELETE FROM tokens WHERE expires_at < ?", now() - DAY);
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
