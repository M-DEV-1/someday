import { DurableObject } from "cloudflare:workers";
import { Cipher } from "./cipher";
import type { Env } from "./env";
import { Letters, type LetterInput } from "./letters";

/** The one Durable Object behind an instance. It owns the SQLite database and hands each call from the Worker to the module that owns that table. */
export class Store extends DurableObject<Env> {
	private letters: Letters;

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env);
		const sql = ctx.storage.sql;
		this.letters = new Letters(sql, new Cipher(sql));
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
}
