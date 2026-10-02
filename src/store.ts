import { DurableObject } from "cloudflare:workers";
import { Cipher } from "./cipher";
import { deliverDue } from "./delivery";
import type { Env } from "./env";
import { Letters, type LetterInput } from "./letters";
import { Sessions } from "./sessions";

/** The one Durable Object behind an instance. It owns the SQLite database and hands each call from the Worker to the module that owns that table. */
export class Store extends DurableObject<Env> {
	private sessions: Sessions;
	private letters: Letters;
	private delivering: Promise<number> | null = null;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const sql = ctx.storage.sql;
		this.sessions = new Sessions(sql);
		this.letters = new Letters(sql, new Cipher(sql));
	}

	createLink() {
		return this.sessions.createLink();
	}

	redeemLink(link: string) {
		return this.sessions.redeemLink(link);
	}

	isSignedIn(session: string) {
		return this.sessions.isValid(session);
	}

	signOut(session: string) {
		return this.sessions.end(session);
	}

	addLetter(input: LetterInput) {
		return this.letters.add(input);
	}

	listLetters() {
		return this.letters.list();
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
