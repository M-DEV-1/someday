/** AES-256-GCM encryption with a key generated the first time the store starts and kept in its own table. */
export class Cipher {
	private key: Promise<CryptoKey>;

	constructor(sql: SqlStorage) {
		sql.exec("CREATE TABLE IF NOT EXISTS cipher_key (id INTEGER PRIMARY KEY CHECK (id = 1), aes_key BLOB NOT NULL)");
		sql.exec("INSERT OR IGNORE INTO cipher_key (id, aes_key) VALUES (1, ?)", crypto.getRandomValues(new Uint8Array(32)).buffer);
		const { aes_key } = sql.exec<{ aes_key: ArrayBuffer }>("SELECT aes_key FROM cipher_key").one();
		this.key = crypto.subtle.importKey("raw", aes_key, "AES-GCM", false, ["encrypt", "decrypt"]);
	}

	/** Output: a 12-byte IV followed by the ciphertext of `text`. */
	async seal(text: string): Promise<ArrayBuffer> {
		const iv = crypto.getRandomValues(new Uint8Array(12));
		const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await this.key, new TextEncoder().encode(text));
		const out = new Uint8Array(12 + ct.byteLength);
		out.set(iv);
		out.set(new Uint8Array(ct), 12);
		return out.buffer;
	}

	async open(sealed: ArrayBuffer): Promise<string> {
		const bytes = new Uint8Array(sealed);
		const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: bytes.subarray(0, 12) }, await this.key, bytes.subarray(12));
		return new TextDecoder().decode(pt);
	}
}
