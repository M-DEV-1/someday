import { connect } from "cloudflare:sockets";

export interface SmtpConfig {
	/** `host` or `host:port`. Port 465 (the default) uses TLS from the start; any other port upgrades with STARTTLS. */
	host: string;
	user: string;
	password: string;
	from: string;
}

export interface Mail {
	to: string;
	subject: string;
	text: string;
	/** Makes the Message-ID, so a letter sent again after a restart is the same message and providers that remove duplicates, such as Gmail, show it once. A random ID is used when absent. */
	id?: string;
	/** A file sent with the text, such as a backup. */
	attachment?: { filename: string; type: string; content: string };
}

const REPLY_TIMEOUT_MS = 20_000;

/** Opens an authenticated SMTP session. Plaintext is used only for localhost, which deployed Workers cannot reach, so it only applies to local tests. */
export async function openSmtp(cfg: SmtpConfig) {
	const [hostname = "", portText] = cfg.host.trim().split(":");
	const port = Number(portText || 465);
	const local = hostname === "localhost" || hostname === "127.0.0.1";
	let socket = connect({ hostname, port }, { secureTransport: port === 465 ? "on" : local ? "off" : "starttls", allowHalfOpen: false });
	let io = wrap(socket);
	try {
		await io.expect(220);
		await io.cmd("EHLO someday", 250);
		if (port !== 465 && !local) {
			await io.cmd("STARTTLS", 220);
			io.release();
			socket = socket.startTls();
			io = wrap(socket);
			await io.cmd("EHLO someday", 250);
		}
		await io.cmd(`AUTH PLAIN ${b64(`\0${cfg.user}\0${cfg.password}`)}`, 235);
	} catch (e) {
		await socket.close().catch(() => {});
		throw e;
	}
	return {
		async send(mail: Mail): Promise<void> {
			await io.cmd(`MAIL FROM:<${cfg.from}>`, 250);
			await io.cmd(`RCPT TO:<${mail.to}>`, 250, 251);
			await io.cmd("DATA", 354);
			await io.cmd(`${message(cfg.from, mail)}\r\n.`, 250);
		},
		async close(): Promise<void> {
			if (!io.dead()) await io.cmd("QUIT", 221).catch(() => {});
			await socket.close().catch(() => {});
		},
	};
}

/** Opens a session, sends one message and closes it. */
export async function sendOne(cfg: SmtpConfig, mail: Mail): Promise<void> {
	const smtp = await openSmtp(cfg);
	try {
		await smtp.send(mail);
	} finally {
		await smtp.close();
	}
}

/** Wraps a socket with line-based SMTP reads and writes. A reply that takes longer than 20 seconds throws and marks the connection dead. */
function wrap(socket: Socket) {
	const reader = socket.readable.getReader();
	const writer = socket.writable.getWriter();
	const decoder = new TextDecoder();
	let buf = "";
	let dead = false;

	async function reply(): Promise<{ code: number; text: string }> {
		for (;;) {
			// A reply ends at the first line whose fourth character is a space, e.g. "250 OK" after "250-SIZE".
			const lines = buf.split("\r\n");
			const last = lines.slice(0, -1).findIndex((l) => l[3] === " " || l.length === 3);
			if (last >= 0) {
				buf = lines.slice(last + 1).join("\r\n");
				return { code: Number(lines[last]?.slice(0, 3)), text: lines.slice(0, last + 1).join(" ") };
			}
			let timer = 0;
			const timeout = new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error("SMTP server did not answer within 20 seconds")), REPLY_TIMEOUT_MS);
			});
			const { value, done } = await Promise.race([reader.read(), timeout])
				.catch((e) => {
					dead = true;
					throw e;
				})
				.finally(() => clearTimeout(timer));
			if (done) {
				dead = true;
				throw new Error("SMTP server closed the connection");
			}
			buf += decoder.decode(value, { stream: true });
		}
	}

	async function expect(...codes: number[]) {
		const r = await reply();
		if (!codes.includes(r.code)) throw new Error(`SMTP server said: ${r.text}`);
		return r;
	}

	return {
		expect,
		/** True once the server has timed out or hung up, so QUIT would only wait another 20 seconds. */
		dead: () => dead,
		async cmd(line: string, ...codes: number[]) {
			await writer.write(new TextEncoder().encode(`${line}\r\n`));
			return expect(...codes);
		},
		release() {
			reader.releaseLock();
			writer.releaseLock();
		},
	};
}

/** Builds a UTF-8 message: plain text, or plain text and one attachment as multipart/mixed. Every part is base64, so no line can start with the "." that ends DATA. */
function message(from: string, mail: Mail): string {
	const head = [
		`From: Someday <${from}>`,
		`To: <${mail.to}>`,
		`Subject: ${encodedWords(mail.subject)}`,
		`Date: ${new Date().toUTCString()}`,
		`Message-ID: <${mail.id ?? crypto.randomUUID()}@${from.split("@")[1] ?? "someday"}>`,
		"MIME-Version: 1.0",
	];
	const text = ["Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: base64", "", base64Lines(mail.text)];
	const file = mail.attachment;
	if (!file) return [...head, ...text].join("\r\n");
	// Base64 never contains "-", so the boundary cannot appear inside a part.
	const boundary = `someday-${crypto.randomUUID()}`;
	return [
		...head,
		`Content-Type: multipart/mixed; boundary="${boundary}"`,
		"",
		`--${boundary}`,
		...text,
		`--${boundary}`,
		`Content-Type: ${file.type}; name="${file.filename}"`,
		`Content-Disposition: attachment; filename="${file.filename}"`,
		"Content-Transfer-Encoding: base64",
		"",
		base64Lines(file.content),
		`--${boundary}--`,
	].join("\r\n");
}

/** Base64 of the UTF-8 bytes of `s`, in lines of 76 characters as MIME requires. */
function base64Lines(s: string): string {
	return b64(s).replace(/.{76}/g, "$&\r\n").trimEnd();
}

/** Encodes a header value as RFC 2047 words of at most 45 UTF-8 bytes each, which keeps every word under the 75-character limit, folded onto separate lines. */
function encodedWords(s: string): string {
	const chunks = [""];
	let bytes = 0;
	for (const ch of s) {
		const n = new TextEncoder().encode(ch).length;
		if (bytes + n > 45) {
			chunks.push("");
			bytes = 0;
		}
		chunks[chunks.length - 1] += ch;
		bytes += n;
	}
	return chunks.map((chunk) => `=?UTF-8?B?${b64(chunk)}?=`).join("\r\n ");
}

/** Base64 of the UTF-8 bytes of `s`. */
function b64(s: string): string {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}

/** The message of a thrown value, which for an SMTP failure is the server's reply. */
export function errorText(e: unknown): string {
	return e instanceof Error ? e.message : String(e);
}
