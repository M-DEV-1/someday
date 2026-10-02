import { DurableObject } from "cloudflare:workers";
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
	private delivering: Promise<number> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const sql = ctx.storage.sql;
		this.sessions = new Sessions(sql);
		this.letters = new Letters(sql, new Cipher(sql));
		this.settings = new SettingsStore(sql);
	}

	createLink() {
		return this.sessions.createLink();
	}

	discardLink(link: string) {
		return this.sessions.discardLink(link);
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

	/** Every letter including sealed bodies, for the owner's export. */
	exportLetters() {
		return this.letters.all();
	}

	readLetter(id: string) {
		return this.letters.delivered(id);
	}

	deleteLetter(id: string) {
		this.letters.remove(id);
	}

	/** Runs one delivery pass. A call that arrives while a pass is running joins it, so overlapping cron runs never send a letter twice. */
	deliverDue(): Promise<number> {
		this.sessions.prune();
		this.delivering ??= deliverDue(this.letters, this.env).finally(() => (this.delivering = null));
		return this.delivering;
	}
}
