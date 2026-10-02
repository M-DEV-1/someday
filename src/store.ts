import { DurableObject } from "cloudflare:workers";
import { Backups } from "./backup";
import { Cipher } from "./cipher";
import { deliverDue } from "./delivery";
import type { Env } from "./env";
import { type LetterInput, Letters } from "./letters";
import { Sessions } from "./sessions";
import { type Settings, SettingsStore } from "./settings";

/** The one Durable Object behind an instance. It owns the SQLite database and hands each call from the Worker to the module that owns that table. */
export class Store extends DurableObject<Env> {
	private sessions: Sessions;
	private letters: Letters;
	private settings: SettingsStore;
	private backups: Backups;
	private delivering: Promise<number> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const sql = ctx.storage.sql;
		this.sessions = new Sessions(sql);
		this.letters = new Letters(sql, new Cipher(sql));
		this.settings = new SettingsStore(sql);
		this.backups = new Backups(sql, this.letters, this.settings);
	}

	createLink() {
		return this.sessions.createLink();
	}

	redeemLink(link: string) {
		return this.sessions.redeemLink(link);
	}

	/** Input: a session cookie. Output: the owner's settings when the session is valid, otherwise null. One call does both, so a page costs one request to the store. */
	async session(cookie: string): Promise<Settings | null> {
		return (await this.sessions.isValid(cookie)) ? this.settings.get() : null;
	}

	saveSettings(settings: Settings) {
		this.settings.save(settings);
	}

	signOut(session: string) {
		return this.sessions.end(session);
	}

	signOutEverywhere() {
		this.sessions.endAll();
	}

	addLetter(input: LetterInput) {
		return this.letters.add(input);
	}

	listLetters() {
		return this.letters.list();
	}

	/** The settings and every letter including sealed bodies, for the owner's backup. */
	/** The backup file as a stream. It is built and turned into text here, where a request may use 30 seconds of CPU, instead of in the Worker, which has 10 ms on the free plan. */
	async backupFile(): Promise<ReadableStream<Uint8Array>> {
		return new Blob([await this.backups.file()]).stream();
	}

	/** Restores an uploaded backup file, read from a stream so the Worker does not decode or parse it. */
	async restoreFile(file: ReadableStream<Uint8Array>) {
		return this.backups.restoreFile(await new Response(file).text());
	}

	readLetter(id: string) {
		return this.letters.delivered(id);
	}

	deleteLetter(id: string) {
		this.letters.remove(id);
	}

	/** Runs one delivery pass: due letters, then the backup email if one is due. A call that arrives while a pass is running joins it, so overlapping cron runs never send a letter twice. */
	deliverDue(): Promise<number> {
		this.sessions.prune();
		this.delivering ??= this.deliveryPass().finally(() => (this.delivering = null));
		return this.delivering;
	}

	/** Sends due letters, then the backup email if one is due. Output: how many letters were sent. */
	private async deliveryPass(): Promise<number> {
		const sent = await deliverDue(this.letters, this.env);
		await this.backups.emailIfDue(this.env);
		return sent;
	}
}
