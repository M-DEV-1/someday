import type { View } from "../http";
import type { Settings } from "../settings";
import { CSS } from "./style";

/** Escapes text for use inside HTML element content and quoted attributes. */
export function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Wraps page content in the shared document and the one-line header. The links show only when signed in. `customCss: false` leaves out the owner's own CSS, which the Settings page uses so a bad rule cannot hide the form that removes it. */
export function layout(view: View, content: string, { customCss = true } = {}): string {
	const s = view.settings;
	const links = view.signedIn
		? `<a href="/">Write</a><a href="/letters">Letters</a><form method="post" action="/signout"><button class="link">Sign out</button></form>`
		: "";
	return `<!doctype html>
<html lang="en"${s.theme === "auto" ? "" : ` data-theme="${s.theme}"`}>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Someday</title>
<style nonce="${view.nonce}">${CSS}${settingsCss(s, customCss)}</style>
</head>
<body>
<header><strong>Someday</strong>${links}</header>
<main>${content}</main>
</body>
</html>`;
}

/** The settings as CSS: custom properties for typeface, size and accent, then the owner's own CSS with every "<" written as the CSS escape \3c, so it cannot close the style element. */
function settingsCss(s: Settings, withCustom: boolean): string {
	const vars = [`--font: var(--font-${s.font})`, `--size: ${s.size}px`, ...(s.accent ? [`--accent: ${s.accent}`] : [])];
	return `:root { ${vars.join("; ")}; }\n${withCustom ? s.css.replace(/</g, "\\3c ") : ""}`;
}
