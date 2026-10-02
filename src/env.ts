import type { SmtpConfig } from "./mail";
import type { Store } from "./store";

/** Bindings and the four secrets the Deploy to Cloudflare button asks for. */
export interface Env {
	STORE: DurableObjectNamespace<Store>;
	OWNER_EMAIL: string;
	SMTP_HOST: string;
	SMTP_USER: string;
	SMTP_PASSWORD: string;
}

const REQUIRED = ["OWNER_EMAIL", "SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD"] as const;

/** Returns the names of required secrets that are empty or unset. */
export function missingConfig(env: Env): string[] {
	return REQUIRED.filter((name) => !env[name]?.trim());
}

/** Sends as the SMTP login when it is an address, otherwise as the owner. */
export function smtpConfig(env: Env): SmtpConfig {
	const user = env.SMTP_USER.trim();
	return { host: env.SMTP_HOST, user, password: env.SMTP_PASSWORD, from: user.includes("@") ? user : env.OWNER_EMAIL.trim() };
}

export function isOwner(env: Env, email: string): boolean {
	return email.trim().toLowerCase() === env.OWNER_EMAIL.trim().toLowerCase();
}
