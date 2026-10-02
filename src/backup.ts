import { configProblems, type Env, smtpConfig } from "./env";
import { type Letter, type Letters, MAX_BODY, MAX_SUBJECT, type StoredLetter } from "./letters";
import { errorText, type Mail, sendOne } from "./mail";
import { checkSettings, type Settings, type SettingsStore } from "./settings";
import { DAY, now, safeTimeZone } from "./time";

const EVERY = 30 * DAY;

/** A full copy of one Someday: the owner's settings and every letter in plain text. Dates are ISO 8601, so the file can be read without Someday. */
export interface Backup {
	format: "someday-backup";
	version: 1;
	exportedAt: string;
	settings: Settings;
	letters: BackupLetter[];
	/** How many letters could not be decrypted and so are not in this file. */
	unreadable: number;
}

/** What a checked backup file restores. */
interface Restore {
	settings: Settings;
	letters: StoredLetter[];
}

interface BackupLetter {
	id: string;
	subject: string;
	body: string;
	timeZone: string;
	written: string;
	deliver: string;
	/** When it was sent, or null for a sealed letter. */
	delivered: string | null;
}

/** Builds backups from the letters and settings tables, and emails one to the owner every 30 days. The `backup_state` table holds when the next email is due and why the last one failed. */
export class Backups {
	constructor(
		private sql: SqlStorage,
		private letters: Letters,
		private settings: SettingsStore,
	) {
		sql.exec("CREATE TABLE IF NOT EXISTS backup_state (id INTEGER PRIMARY KEY CHECK (id = 1), next_at INTEGER NOT NULL, last_error TEXT)");
	}

	/**
	 * Emails a backup to the owner when one is due: on the first delivery pass after the first letter is written, then every 30 days.
	 * A failed send is tried again a day later. Nothing is sent while the owner has the email turned off, the secrets are not set, or there are no letters.
	 */
	async emailIfDue(env: Env): Promise<void> {
		if (!this.settings.get().backup || configProblems(env).length > 0) return;
		const t = now();
		const next = this.sql.exec<{ next_at: number }>("SELECT next_at FROM backup_state").toArray()[0]?.next_at ?? 0;
		if (next > t) return;
		const backup = await this.build();
		if (backup.letters.length === 0 && backup.unreadable === 0) return;
		try {
			// ponytail: the whole backup goes in one attachment; Gmail refuses messages over 25 MB, about 18 MB of letters
			await sendOne(smtpConfig(env), backupMail(backup, env.OWNER_EMAIL.trim()));
			this.scheduleNext(t + EVERY, null);
		} catch (e) {
			console.error(`Backup email failed: ${errorText(e)}`);
			this.scheduleNext(t + DAY, errorText(e));
		}
	}

	/** Replaces the settings with the backup's and adds its letters. A letter whose ID is already here is skipped, so restoring the same file twice adds nothing. */
	/** Restores from the text of an uploaded backup file. Output: how many letters were added and skipped, or an error that says what is wrong, in which case nothing changed. */
	async restoreFile(text: string): Promise<{ added: number; skipped: number } | { error: string }> {
		let raw: unknown;
		try {
			raw = JSON.parse(text);
		} catch {
			return { error: "That file is not a Someday backup." };
		}
		const read = readBackup(raw);
		return "error" in read ? read : this.restore(read.restore);
	}

	private async restore(r: Restore): Promise<{ added: number; skipped: number }> {
		this.settings.save(r.settings);
		let added = 0;
		for (const letter of r.letters) if (await this.letters.insert(letter)) added++;
		return { added, skipped: r.letters.length - added };
	}

	/** Why the last backup email failed, or null when it was sent or none has been tried. */
	lastError(): string | null {
		return this.sql.exec<{ last_error: string | null }>("SELECT last_error FROM backup_state").toArray()[0]?.last_error ?? null;
	}

	private scheduleNext(at: number, error: string | null): void {
		this.sql.exec("INSERT OR REPLACE INTO backup_state (id, next_at, last_error) VALUES (1, ?, ?)", at, error);
	}

	/** Every readable letter and the settings. Letters that can no longer be decrypted are left out, since their text is gone, and counted in `unreadable`. */
	/** The text of a backup file. */
	async file(): Promise<string> {
		return JSON.stringify(await this.build(), null, "\t");
	}

	private async build(): Promise<Backup> {
		const all = await this.letters.all();
		const letters = all.filter((l) => !l.unreadable).map(toBackupLetter);
		return {
			format: "someday-backup",
			version: 1,
			exportedAt: new Date().toISOString(),
			settings: this.settings.get(),
			letters,
			unreadable: all.length - letters.length,
		};
	}
}

function toBackupLetter(l: Letter): BackupLetter {
	const iso = (ts: number) => new Date(ts * 1000).toISOString();
	return {
		id: l.id,
		subject: l.subject,
		body: l.body,
		timeZone: l.tz,
		written: iso(l.createdAt),
		deliver: iso(l.deliverAt),
		delivered: l.sentAt === null ? null : iso(l.sentAt),
	};
}

/**
 * Checks an uploaded backup file. Input: the parsed JSON. Output: what to restore, or an error that says what is wrong.
 * Letters are held to the write form's limits, and a sealed letter whose date has passed is restored as due, so the next delivery pass sends it.
 */
function readBackup(raw: unknown): { restore: Restore } | { error: string } {
	if (!isObject(raw) || raw["format"] !== "someday-backup") return { error: "That file is not a Someday backup." };
	if (raw["version"] !== 1) return { error: "That backup was made by a newer Someday. Update this one, then restore." };
	const list = raw["letters"];
	if (!Array.isArray(list)) return { error: "That backup has no list of letters." };
	const letters: StoredLetter[] = [];
	for (const [i, item] of list.entries()) {
		const letter = readLetter(item);
		if (!letter) return { error: `Letter ${i + 1} in the backup is damaged, so nothing was restored.` };
		letters.push(letter);
	}
	const { settings, error } = checkSettings(isObject(raw["settings"]) ? raw["settings"] : {});
	if (error) return { error: `The settings in the backup are damaged: ${error}` };
	return { restore: { settings, letters } };
}

function readLetter(v: unknown): StoredLetter | null {
	if (!isObject(v)) return null;
	const { id, subject, body, timeZone, written, deliver, delivered } = v;
	if (typeof id !== "string" || !/^[0-9A-Z]{26}$/.test(id)) return null;
	if (typeof subject !== "string" || !subject || subject.length > MAX_SUBJECT) return null;
	if (typeof body !== "string" || body.length > MAX_BODY) return null;
	const createdAt = seconds(written);
	const deliverAt = seconds(deliver);
	const sentAt = delivered === null ? null : seconds(delivered);
	if (createdAt === null || deliverAt === null || (delivered !== null && sentAt === null)) return null;
	return { id, subject, body, tz: safeTimeZone(typeof timeZone === "string" ? timeZone : "UTC"), createdAt, deliverAt, sentAt };
}

/** Unix seconds from an ISO 8601 date, or null when it is not one. */
function seconds(v: unknown): number | null {
	const ms = typeof v === "string" ? Date.parse(v) : Number.NaN;
	return Number.isFinite(ms) ? Math.floor(ms / 1000) : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
	return typeof v === "object" && v !== null && !Array.isArray(v);
}

function backupMail(backup: Backup, to: string): Mail {
	const today = new Date().toLocaleDateString("en-US", { dateStyle: "medium" });
	const n = backup.letters.length;
	const lost =
		backup.unreadable > 0
			? `\n\n${backup.unreadable} ${backup.unreadable === 1 ? "letter" : "letters"} could not be decrypted and ${backup.unreadable === 1 ? "is" : "are"} not in the file.`
			: "";
	return {
		to,
		subject: `Someday backup, ${today}`,
		text: `Your Someday backup is attached: ${n} ${n === 1 ? "letter" : "letters"} and your settings.${lost}\n\nThe file holds every letter in plain text, sealed ones included, so opening it shows letters that have not arrived yet.\n\nTo move to a new Someday, deploy one and use Restore on its Settings page. The next backup comes in 30 days; you can turn these emails off in Settings.\n`,
		attachment: { filename: backupFilename(), type: "application/json", content: JSON.stringify(backup, null, "\t") },
	};
}

/** The file name for a backup made today, like someday-backup-2026-10-02.json. */
export function backupFilename(): string {
	return `someday-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
