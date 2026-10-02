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
const ADDRESS = /^[^\s<>@]+@[^\s<>@]+$/;

/** Returns one sentence for each secret that is empty or malformed, or an empty list when all four are usable. */
export function configProblems(env: Env): string[] {
	const problems = REQUIRED.filter((name) => !env[name]?.trim()).map((name) => `${name} is empty.`);
	if (env.OWNER_EMAIL?.trim() && !ADDRESS.test(env.OWNER_EMAIL.trim())) problems.push("OWNER_EMAIL is not an email address.");
	if (env.SMTP_USER?.includes("@") && !ADDRESS.test(env.SMTP_USER.trim())) problems.push("SMTP_USER contains @ but is not an email address.");
	return problems;
}

/** Sends as the SMTP login when it is an address, otherwise as the owner. */
export function smtpConfig(env: Env): SmtpConfig {
	const user = env.SMTP_USER.trim();
	return { host: env.SMTP_HOST, user, password: env.SMTP_PASSWORD.trim(), from: user.includes("@") ? user : env.OWNER_EMAIL.trim() };
}

export function isOwner(env: Env, email: string): boolean {
	return email.trim().toLowerCase() === env.OWNER_EMAIL.trim().toLowerCase();
}
