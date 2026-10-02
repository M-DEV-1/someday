import type { Cipher } from "./cipher";
import { DAY, now } from "./time";

export interface LetterInput {
	subject: string;
	body: string;
	/** Unix seconds. */
	deliverAt: number;
	/** The writer's IANA time zone, used to show dates the way the writer saw them. */
	tz: string;
}

/** A letter with its ID, dates and delivery state, as restored from a backup. */
export interface StoredLetter extends LetterInput {
	id: string;
	/** Unix seconds. */
	createdAt: number;
	/** Unix seconds, or null when not delivered yet. */
	sentAt: number | null;
}

export interface LetterSummary {
	id: string;
	subject: string;
	tz: string;
	createdAt: number;
	deliverAt: number;
	sentAt: number | null;
	attempts: number;
	lastError: string | null;
	/** True when the stored text could not be decrypted, for example after the key row was lost. */
	unreadable: boolean;
}

export interface Letter extends LetterSummary {
	body: string;
}

/** A letter that has been sent, so `sentAt` is set. */
export type Delivered<T extends LetterSummary> = T & { sentAt: number };

export function isDelivered<T extends LetterSummary>(letter: T): letter is Delivered<T> {
	return letter.sentAt !== null;
}

type Row = {
	id: string;
	sealed: ArrayBuffer;
	tz: string;
	created_at: number;
	deliver_at: number;
	sent_at: number | null;
	attempts: number;
	last_error: string | null;
};

const RETRY_BASE = 5 * 60;

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
		sql.exec("CREATE INDEX IF NOT EXISTS letters_due ON letters (sent_at, deliver_at)");
	}

	/** Encrypts and stores a new letter. Returns its ID. */
	async add(input: LetterInput): Promise<string> {
		const id = ulid();
		await this.insert({ ...input, id, createdAt: now(), sentAt: null });
		return id;
	}

	/** Encrypts and stores a letter with a given ID and state. Returns false, and changes nothing, when a letter with that ID already exists. */
	async insert(l: StoredLetter): Promise<boolean> {
		const sealed = await this.cipher.seal(JSON.stringify({ subject: l.subject, body: l.body }));
		return (
			this.sql.exec(
				"INSERT OR IGNORE INTO letters (id, sealed, tz, created_at, deliver_at, sent_at) VALUES (?, ?, ?, ?, ?, ?)",
				l.id,
				sealed,
				l.tz,
				l.createdAt,
				l.deliverAt,
				l.sentAt,
			).rowsWritten > 0
		);
	}

	/** Every letter with its body, soonest delivery first. */
	async all(): Promise<Letter[]> {
		// ponytail: decrypts every row on each call, add paging if an owner ever keeps thousands of letters
		const rows = this.sql.exec<Row>("SELECT * FROM letters ORDER BY deliver_at").toArray();
		return Promise.all(rows.map((r) => this.unseal(r)));
	}

	/** Every letter, soonest delivery first, without bodies. */
	async list(): Promise<LetterSummary[]> {
		return (await this.all()).map(({ body: _, ...summary }) => summary);
	}

	/** Returns a letter only once it has been delivered; upcoming letters stay sealed. */
	async delivered(id: string): Promise<Delivered<Letter> | null> {
		const row = this.sql.exec<Row>("SELECT * FROM letters WHERE id = ? AND sent_at IS NOT NULL", id).toArray()[0];
		if (!row) return null;
		const letter = await this.unseal(row);
		return isDelivered(letter) ? letter : null;
	}

	remove(id: string): void {
		this.sql.exec("DELETE FROM letters WHERE id = ?", id);
	}

	/** Unsent letters whose delivery time, or retry time after a failure, has passed. */
	async due(limit: number): Promise<Letter[]> {
		const rows = this.sql
			.exec<Row>("SELECT * FROM letters WHERE sent_at IS NULL AND COALESCE(retry_at, deliver_at) <= ? ORDER BY deliver_at LIMIT ?", now(), limit)
			.toArray();
		const letters = await Promise.all(rows.map((r) => this.unseal(r)));
		for (const l of letters) if (l.unreadable) this.markFailed(l.id, "This letter could not be decrypted.");
		return letters.filter((l) => !l.unreadable);
	}

	markSent(id: string): void {
		this.sql.exec("UPDATE letters SET sent_at = ?, retry_at = NULL, last_error = NULL WHERE id = ?", now(), id);
	}

	/** Records a failed attempt. The next try waits 5 minutes, doubling each time up to one day, and retries never stop. */
	markFailed(id: string, error: string): void {
		this.sql.exec(
			"UPDATE letters SET attempts = attempts + 1, last_error = ?, retry_at = ? + MIN(? * (1 << MIN(attempts, 20)), ?) WHERE id = ?",
			error,
			now(),
			RETRY_BASE,
			DAY,
			id,
		);
	}

	/** Decrypts a row. A row that cannot be decrypted comes back marked `unreadable` instead of throwing, so one damaged row cannot break the list or delivery. */
	private async unseal(r: Row): Promise<Letter> {
		const letter = {
			id: r.id,
			subject: "(could not be decrypted)",
			body: "",
			tz: r.tz,
			createdAt: r.created_at,
			deliverAt: r.deliver_at,
			sentAt: r.sent_at,
			attempts: r.attempts,
			lastError: r.last_error,
			unreadable: true,
		};
		try {
			const { subject, body }: { subject?: unknown; body?: unknown } = JSON.parse(await this.cipher.open(r.sealed));
			if (typeof subject !== "string" || typeof body !== "string") return letter;
			return { ...letter, subject, body, unreadable: false };
		} catch {
			return letter;
		}
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
