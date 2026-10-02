import type { Cipher } from "./cipher";
import { now } from "./time";

export interface LetterInput {
	subject: string;
	body: string;
	/** Unix seconds. */
	deliverAt: number;
	/** The writer's IANA time zone, used to show dates the way the writer saw them. */
	tz: string;
}

/** Letter storage. Subject and body are encrypted together; dates and delivery state are stored in the clear so due letters can be found. */
export class Letters {
	constructor(
		private sql: SqlStorage,
		private cipher: Cipher,
	) {
		sql.exec(`CREATE TABLE IF NOT EXISTS letters (
			id TEXT PRIMARY KEY,
			sealed BLOB NOT NULL,
			tz TEXT NOT NULL,
			created_at INTEGER NOT NULL,
			deliver_at INTEGER NOT NULL,
			sent_at INTEGER,
			retry_at INTEGER,
			attempts INTEGER NOT NULL DEFAULT 0,
			last_error TEXT
		)`);
	}

	/** Encrypts and stores a letter. Returns its ID. */
	async add(input: LetterInput): Promise<string> {
		const id = ulid();
		const sealed = await this.cipher.seal(JSON.stringify({ subject: input.subject, body: input.body }));
		this.sql.exec("INSERT INTO letters (id, sealed, tz, created_at, deliver_at) VALUES (?, ?, ?, ?, ?)", id, sealed, input.tz, now(), input.deliverAt);
		return id;
	}
}

const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

/** A 26-character ULID: 10 characters of millisecond time, then 16 random characters. */
function ulid(): string {
	let time = Date.now();
	let out = "";
	for (let i = 0; i < 10; i++, time = Math.floor(time / 32)) out = CROCKFORD[time % 32] + out;
	for (const b of crypto.getRandomValues(new Uint8Array(16))) out += CROCKFORD[b % 32];
	return out;
}
