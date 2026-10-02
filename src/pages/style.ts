export const CSS = `
:root { color-scheme: light dark; --fg: #1f1d1a; --muted: #6b665e; --bg: #f4f0e8; --paper: #fffdf8; --line: #e2dccf; --accent: #8a4b2a; --on-accent: #fffdf8; --bad: #a32d2d; }
@media (prefers-color-scheme: dark) { :root { --fg: #ece8e1; --muted: #a39d93; --bg: #1b1a18; --paper: #24221f; --line: #3a3732; --accent: #e0a17a; --on-accent: #1b1a18; --bad: #f09595; } }
* { box-sizing: border-box; }
body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.6 system-ui, sans-serif; }
a { color: inherit; }
header { max-width: 1040px; margin: 0 auto; padding: 20px 16px; display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.logo { font: 400 24px Georgia, serif; text-decoration: none; letter-spacing: 0.02em; }
nav { display: flex; gap: 20px; align-items: center; font-size: 15px; }
nav a { text-decoration: none; }
nav form { display: inline; }
main { max-width: 1040px; margin: 0 auto; padding: 8px 16px 64px; }
.narrow { max-width: 560px; }
h1 { font: 400 40px/1.15 Georgia, serif; margin: 16px 0 8px; }
h2 { font: 400 28px/1.2 Georgia, serif; margin: 0 0 8px; }
h3 { font-size: 15px; font-weight: 500; color: var(--muted); margin: 32px 0 4px; }
.lede { color: var(--muted); margin: 0 0 24px; }
.muted { color: var(--muted); font-size: 14px; }
.error { color: var(--bad); }
.notice { background: var(--paper); border-left: 3px solid var(--accent); padding: 12px 16px; margin: 0 0 24px; }
.card, .paper { background: var(--paper); border: 1px solid var(--line); border-radius: 12px; padding: 24px; }
label { display: block; font-size: 14px; color: var(--muted); margin: 0 0 6px; }
input, textarea, button { font: inherit; color: inherit; }
input[type=email], input[type=date], input[type=text] { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 8px; background: var(--bg); }
button { padding: 10px 18px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent); color: var(--on-accent); cursor: pointer; }
button.big { width: 100%; padding: 14px; font-size: 18px; }
button.link { background: none; border: none; color: var(--muted); padding: 0; font-size: 14px; text-decoration: underline; }
.write { display: grid; grid-template-columns: minmax(0, 2fr) minmax(260px, 1fr); gap: 24px; align-items: start; }
@media (max-width: 760px) { .write { grid-template-columns: minmax(0, 1fr); } h1 { font-size: 32px; } }
.paper input.subject { width: 100%; border: none; border-bottom: 1px solid var(--line); background: none; padding: 0 0 8px; font-size: 15px; color: var(--muted); }
.paper textarea { width: 100%; min-height: 420px; border: none; background: none; resize: vertical; padding: 16px 0; font: 19px/1.7 Georgia, serif; outline: none; }
.paper-foot { display: flex; justify-content: space-between; gap: 16px; align-items: baseline; border-top: 1px solid var(--line); padding-top: 10px; }
#prompt { font-style: italic; flex: 1; }
aside > * + * { margin-top: 20px; }
.chips { display: flex; flex-wrap: wrap; gap: 8px; }
.chips input { position: absolute; opacity: 0; }
.chips label { margin: 0; padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; color: var(--fg); cursor: pointer; }
.chips input:checked + label { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.chips input:focus-visible + label { outline: 2px solid var(--accent); outline-offset: 2px; }
`;
