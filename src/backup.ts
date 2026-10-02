import type { Letter, Letters } from "./letters";
import type { Settings, SettingsStore } from "./settings";

/** A full copy of one Someday: the owner's settings and every letter in plain text. Dates are ISO 8601, so the file can be read without Someday. */
export interface Backup {
	format: "someday-backup";
	version: 1;
	exportedAt: string;
	settings: Settings;
	letters: BackupLetter[];
}

export interface BackupLetter {
	id: string;
	subject: string;
	body: string;
	timeZone: string;
	written: string;
	deliver: string;
	/** When it was sent, or null for a sealed letter. */
	delivered: string | null;
}

/** Builds backups from the letters and settings tables. */
export class Backups {
	constructor(
		private letters: Letters,
		private settings: SettingsStore,
	) {}

	/** Every readable letter and the settings. Letters that can no longer be decrypted are left out, since their text is gone. */
	async build(): Promise<Backup> {
		const letters = (await this.letters.all()).filter((l) => !l.unreadable).map(toBackupLetter);
		return { format: "someday-backup", version: 1, exportedAt: new Date().toISOString(), settings: this.settings.get(), letters };
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

/** The file name for a backup made today, like someday-backup-2026-10-02.json. */
export function backupFilename(): string {
	return `someday-backup-${new Date().toISOString().slice(0, 10)}.json`;
}
