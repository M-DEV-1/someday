import { configProblems, type Env, smtpConfig } from "./env";
import type { Letter, Letters } from "./letters";
import { errorText, type Mail, openSmtp } from "./mail";
import { formatDate } from "./time";

/** Letters sent per run. The cron runs every 5 minutes, so this allows 7,200 letters a day. */
const BATCH = 25;

/**
 * Sends due letters to the owner over one SMTP connection. Output: how many were sent.
 * If the connection or login fails, every due letter is marked failed. If the server refuses one letter, only that letter is marked failed, the session is reset, and the pass goes on with the next letter.
 * If two letters in a row are refused, the server is likely refusing everything (a daily sending limit, for example), so the pass stops and the rest wait untouched instead of each moving toward the one-day backoff. The pass also stops when the connection is lost. Failed letters are retried with backoff.
 */
export async function deliverDue(letters: Letters, env: Env): Promise<number> {
	const due = await letters.due(BATCH);
	if (!due.length) return 0;

	// Recorded on each letter, because the letters page is the only place a broken setup can show up.
	const problems = configProblems(env);
	if (problems.length) {
		for (const letter of due) letters.markFailed(letter.id, `Not set up: ${problems.join(" ")}`);
		return 0;
	}

	let smtp: Awaited<ReturnType<typeof openSmtp>>;
	try {
		smtp = await openSmtp(smtpConfig(env));
	} catch (e) {
		for (const letter of due) letters.markFailed(letter.id, errorText(e));
		return 0;
	}

	let sent = 0;
	let refusedInARow = 0;
	try {
		for (const letter of due) {
			try {
				await smtp.send(letterMail(letter, env.OWNER_EMAIL.trim()));
			} catch (e) {
				letters.markFailed(letter.id, errorText(e));
				refusedInARow++;
				if (refusedInARow < 2 && (await smtp.reset())) continue;
				break;
			}
			letters.markSent(letter.id);
			sent++;
			refusedInARow = 0;
		}
	} finally {
		await smtp.close();
	}
	return sent;
}

function letterMail(letter: Letter, to: string): Mail {
	const written = formatDate(letter.createdAt, letter.tz);
	const promised = formatDate(letter.deliverAt, letter.tz);
	return {
		to,
		id: letter.id,
		subject: letter.subject,
		text: `${letter.body}\n\n--\nYou wrote this on ${written} and asked Someday to deliver it on ${promised}.\n`,
	};
}
