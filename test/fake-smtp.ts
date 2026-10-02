// A minimal plaintext SMTP server for the end-to-end test. It accepts any login unless `rejectAuth` is set, and decodes each message into `inbox`.
import net from "node:net";

export interface Mail {
	to: string;
	subject: string;
	text: string;
}

export interface FakeSmtp {
	inbox: Mail[];
	rejectAuth: boolean;
	close(): void;
}

export function startFakeSmtp(port: number): FakeSmtp {
	const server = net.createServer((sock) => {
		let buf = "";
		let data: string | null = null;
		const say = (line: string) => sock.write(`${line}\r\n`);
		say("220 fake ESMTP");
		sock.on("data", (chunk) => {
			buf += chunk.toString();
			for (let i = buf.indexOf("\r\n"); i >= 0; i = buf.indexOf("\r\n")) {
				const line = buf.slice(0, i);
				buf = buf.slice(i + 2);
				if (data !== null) {
					if (line === ".") {
						smtp.inbox.push(decode(data));
						data = null;
						say("250 queued");
					} else data += `${line}\r\n`;
					continue;
				}
				const verb = line.slice(0, 4).toUpperCase();
				if (verb === "EHLO") say("250-fake\r\n250 AUTH PLAIN");
				else if (verb === "AUTH") say(smtp.rejectAuth ? "535 5.7.8 Username and Password not accepted" : "235 ok");
				else if (verb === "MAIL" || verb === "RCPT") say("250 ok");
				else if (verb === "DATA") {
					data = "";
					say("354 go ahead");
				} else if (verb === "QUIT") {
					say("221 bye");
					sock.end();
				} else say("502 unknown command");
			}
		});
	});
	const smtp: FakeSmtp = { inbox: [], rejectAuth: false, close: () => server.close() };
	server.listen(port, "127.0.0.1");
	return smtp;
}

/** Turns a raw message into its recipient, subject and text, undoing header folding, encoded words and the base64 body. */
function decode(raw: string): Mail {
	const [head = "", body = ""] = raw.split("\r\n\r\n");
	const headers = head.replace(/\r\n /g, " ");
	const header = (name: string) => headers.match(new RegExp(`^${name}: (.*)$`, "m"))?.[1] ?? "";
	const subject = header("Subject")
		.replace(/\?= =\?/g, "?==?")
		.replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b: string) => Buffer.from(b, "base64").toString("utf8"));
	return { to: header("To"), subject, text: Buffer.from(body.replace(/\r\n/g, ""), "base64").toString("utf8") };
}
