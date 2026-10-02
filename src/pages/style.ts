/** The built-in stylesheet. Everything is sized in em from --size so the text-size setting scales the whole page; the owner's settings override the custom properties at the top. */
export const CSS = `
:root {
	color-scheme: light dark;
	--font-serif: Charter, "Bitstream Charter", "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Cambria, "Noto Serif", "Liberation Serif", Georgia, serif;
	--font-sans: system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", "Liberation Sans", sans-serif;
	--font-mono: ui-monospace, "SF Mono", Menlo, Consolas, "Liberation Mono", "DejaVu Sans Mono", monospace;
	--font: var(--font-serif);
	--size: 18px;
	--fg: light-dark(#000, #e6e6e6);
	--bg: light-dark(#fff, #111);
	--muted: light-dark(#555, #999);
	--line: light-dark(#767676, #777);
	--bad: light-dark(#b00000, #ff7b7b);
	--accent: var(--fg);
}
:root[data-theme=light] { color-scheme: light; }
:root[data-theme=dark] { color-scheme: dark; }
* { box-sizing: border-box; }
html { background: var(--bg); }
body { margin: 0 auto; max-width: 70ch; padding: 1.5em 16px 4em; font: var(--size)/1.5 var(--font); color: var(--fg); background: var(--bg); }
header { display: flex; flex-wrap: wrap; gap: 1.5em; font-size: .875em; margin-bottom: 3em; }
header form { display: inline; margin: 0; }
h1 { font-size: 1em; font-weight: 700; margin: 3em 0 .75em; }
main > h1:first-child, main > form:first-child > h1:first-child { margin-top: 0; }
p, ul, details, form { margin: 0 0 1.5em; }
.small { font-size: .875em; color: var(--muted); }
.bad { color: var(--bad); }
a { color: var(--accent); text-underline-offset: .15em; }
input, select, textarea, button { font: inherit; color: inherit; background: none; border-radius: 0; }
input[type=text], input[type=email] { width: 100%; border: 0; border-bottom: 1px solid var(--line); padding: .25em 0; }
select, input[type=date] { border: 1px solid var(--line); padding: .2em .4em; background: var(--bg); }
button { border: 1px solid var(--fg); padding: .3em .9em; cursor: pointer; }
button.primary { background: var(--accent); border-color: var(--accent); color: var(--bg); }
button.link { border: 0; padding: 0; color: var(--accent); text-decoration: underline; text-underline-offset: .15em; }
textarea { width: 100%; border: 0; padding: 0; resize: vertical; min-height: 60vh; field-sizing: content; outline: 0; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.subject { font-weight: 700; }
.inline { display: flex; flex-wrap: wrap; gap: .5em; align-items: baseline; }
.inline input[type=email] { flex: 1 1 14em; width: auto; }
.letters { list-style: none; padding: 0; }
.letters li { display: grid; grid-template-columns: 8em 1fr auto; gap: 1em; padding: .4em 0; border-top: 1px solid var(--line); }
.letters li > .bad { grid-column: 2 / -1; }
.letters time { font-variant-numeric: tabular-nums; color: var(--muted); }
.letters form { margin: 0; }
.small + h1 { margin-top: .75em; }
.body { white-space: pre-wrap; margin: 0 0 3em; }
.fields { display: grid; grid-template-columns: 10em 1fr; gap: .75em 1em; align-items: baseline; margin-bottom: 1.5em; }
.fields textarea { min-height: 8em; border: 1px solid var(--line); padding: .4em; }
@media (max-width: 480px) {
	header { gap: 1em; }
	.letters li { grid-template-columns: 1fr auto; row-gap: 0; }
	.letters time { grid-column: 1 / -1; }
	.letters li > .bad { grid-column: 1 / -1; }
	.fields { grid-template-columns: 1fr; }
}
`;
