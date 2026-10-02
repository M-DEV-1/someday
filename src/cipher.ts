/** AES-256-GCM encryption with a key generated the first time the store starts and kept in its own table. */
export class Cipher {
	private key: Promise<CryptoKey>;

	constructor(sql: SqlStorage) {
		sql.exec("CREATE TABLE IF NOT EXISTS cipher_key (id INTEGER PRIMARY KEY CHECK (id = 1), aes_key BLOB NOT NULL)");
		sql.exec("INSERT OR IGNORE INTO cipher_key (id, aes_key) VALUES (1, ?)", crypto.getRandomValues(new Uint8Array(32)).buffer);
		const { aes_key } = sql.exec<{ aes_key: ArrayBuffer }>("SELECT aes_key FROM cipher_key").one();
		this.key = crypto.subtle.importKey("raw", aes_key, "AES-GCM", false, ["encrypt", "decrypt"]);
	}
}
