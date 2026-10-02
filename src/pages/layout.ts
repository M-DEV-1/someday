import type { View } from "../http";
import { CSS } from "./style";

/** Escapes text for use inside HTML element content and quoted attributes. */
export function esc(s: string): string {
	return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

/** Wraps page content in the shared document and the one-line header. The links show only when signed in. */
export function layout(view: View, content: string): string {
	const links = view.signedIn
		? `<a href="/">Write</a><a href="/letters">Letters</a><form method="post" action="/signout"><button class="link">Sign out</button></form>`
		: "";
	return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Someday</title>
<style nonce="${view.nonce}">${CSS}</style>
</head>
<body>
<header><strong>Someday</strong>${links}</header>
<main>${content}</main>
</body>
</html>`;
}
