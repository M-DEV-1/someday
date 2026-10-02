import { configProblems, smtpConfig, type Env } from "./env";
import type { Letter, Letters } from "./letters";
import { openSmtp, type Mail } from "./mail";
import { formatDate } from "./time";

/** Letters sent per run. The cron runs every 5 minutes, so this allows 7,200 letters a day. */
const BATCH = 25;

/** Sends due letters to the owner over one SMTP connection. Output: how many were sent. When a send fails, that letter and the ones after it in the batch are marked failed and retried later with backoff. */
export async function deliverDue(letters: Letters, env: Env): Promise<number> {
	if (configProblems(env).length) return 0;
	const due = await letters.due(BATCH);
	if (!due.length) return 0;

	let sent = 0;
	let smtp: Awaited<ReturnType<typeof openSmtp>> | undefined;
	try {
		smtp = await openSmtp(smtpConfig(env));
		for (const letter of due) {
			await smtp.send(letterMail(letter, env.OWNER_EMAIL.trim()));
			letters.markSent(letter.id);
			sent++;
		}
	} catch (e) {
		const error = e instanceof Error ? e.message : String(e);
		for (const letter of due.slice(sent)) letters.markFailed(letter.id, error);
	} finally {
		await smtp?.close();
	}
	return sent;
}

function letterMail(letter: Letter, to: string): Mail {
	const written = formatDate(letter.createdAt, letter.tz);
	const promised = formatDate(letter.deliverAt, letter.tz);
	return { to, subject: letter.subject, text: `${letter.body}\n\n--\nYou wrote this on ${written} and asked Someday to deliver it on ${promised}.\n` };
}
