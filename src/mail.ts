import { connect } from "cloudflare:sockets";

export interface SmtpConfig {
	/** `host` or `host:port`. The default port is 465, and every port uses TLS from the start. */
	host: string;
	user: string;
	password: string;
	from: string;
}

export interface Mail {
	to: string;
	subject: string;
	text: string;
}

const REPLY_TIMEOUT_MS = 20_000;

/** Opens an authenticated SMTP session. Plaintext is used only for localhost, which deployed Workers cannot reach, so it only applies to local tests. */
export async function openSmtp(cfg: SmtpConfig) {
	const [hostname, portText] = cfg.host.trim().split(":");
	const port = Number(portText || 465);
	const local = hostname === "localhost" || hostname === "127.0.0.1";
	let socket = connect({ hostname, port }, { secureTransport: local ? "off" : "on", allowHalfOpen: false });
	let io = wrap(socket);
	try {
		await io.expect(220);
		await io.cmd("EHLO someday", 250);
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
			await io.cmd("QUIT", 221).catch(() => {});
			await socket.close().catch(() => {});
		},
	};
}

/** Wraps a socket with line-based SMTP reads and writes. A reply that takes longer than 20 seconds throws. */
function wrap(socket: Socket) {
	const reader = socket.readable.getReader();
	const writer = socket.writable.getWriter();
	const decoder = new TextDecoder();
	let buf = "";

	async function reply(): Promise<{ code: number; text: string }> {
		for (;;) {
			// A reply ends at the first line whose fourth character is a space, e.g. "250 OK" after "250-SIZE".
			const lines = buf.split("\r\n");
			const last = lines.slice(0, -1).findIndex((l) => l[3] === " " || l.length === 3);
			if (last >= 0) {
				buf = lines.slice(last + 1).join("\r\n");
				return { code: Number(lines[last].slice(0, 3)), text: lines.slice(0, last + 1).join(" ") };
			}
			let timer = 0;
			const timeout = new Promise<never>((_, reject) => {
				timer = setTimeout(() => reject(new Error("SMTP server did not answer within 20 seconds")), REPLY_TIMEOUT_MS);
			});
			const { value, done } = await Promise.race([reader.read(), timeout]).finally(() => clearTimeout(timer));
			if (done) throw new Error("SMTP server closed the connection");
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

/** Builds a plain-text UTF-8 message. The body is base64, so no line can start with the "." that ends DATA. */
function message(from: string, mail: Mail): string {
	// Encoded words are kept short and folded so long or non-ASCII subjects stay under the 998-character header line limit.
	const subject = (mail.subject.match(/.{1,30}/gsu) ?? [""]).map((chunk) => `=?UTF-8?B?${b64(chunk)}?=`).join("\r\n ");
	return [
		`From: Someday <${from}>`,
		`To: <${mail.to}>`,
		`Subject: ${subject}`,
		`Date: ${new Date().toUTCString()}`,
		`Message-ID: <${crypto.randomUUID()}@${from.split("@")[1] ?? "someday"}>`,
		"MIME-Version: 1.0",
		"Content-Type: text/plain; charset=utf-8",
		"Content-Transfer-Encoding: base64",
		"",
		b64(mail.text).replace(/.{76}/g, "$&\r\n"),
	].join("\r\n");
}

/** Base64 of the UTF-8 bytes of `s`. */
function b64(s: string): string {
	const bytes = new TextEncoder().encode(s);
	let bin = "";
	for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
	return btoa(bin);
}
