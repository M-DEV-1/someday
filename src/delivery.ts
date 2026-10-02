import { configProblems, smtpConfig, type Env } from "./env";
import type { Letter, Letters } from "./letters";
import { openSmtp, type Mail } from "./mail";
import { formatDate } from "./time";

/** Letters sent per run. The cron runs every 5 minutes, so this allows 7,200 letters a day. */
const BATCH = 25;

/**
 * Sends due letters to the owner over one SMTP connection. Output: how many were sent.
 * If the connection or login fails, every due letter is marked failed. If the server refuses one letter, only that letter is marked failed and the pass stops; the rest go out on the next pass, so one refused letter cannot hold the others back. Failed letters are retried with backoff.
 */
export async function deliverDue(letters: Letters, env: Env): Promise<number> {
	const due = await letters.due(BATCH);
	if (!due.length) return 0;

	let smtp: Awaited<ReturnType<typeof openSmtp>>;
	try {
		smtp = await openSmtp(smtpConfig(env));
	} catch (e) {
		for (const letter of due) letters.markFailed(letter.id, message(e));
		return 0;
	}

	let sent = 0;
	try {
		for (const letter of due) {
			try {
				await smtp.send(letterMail(letter, env.OWNER_EMAIL.trim()));
			} catch (e) {
				letters.markFailed(letter.id, message(e));
				break;
			}
			letters.markSent(letter.id);
			sent++;
		}
	} finally {
		await smtp.close();
	}
	return sent;
}

function message(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}

function letterMail(letter: Letter, to: string): Mail {
	const written = formatDate(letter.createdAt, letter.tz);
	const promised = formatDate(letter.deliverAt, letter.tz);
	return { to, subject: letter.subject, text: `${letter.body}\n\n--\nYou wrote this on ${written} and asked Someday to deliver it on ${promised}.\n` };
}
