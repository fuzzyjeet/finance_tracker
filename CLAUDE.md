# JeetMoney finance tracker

React + Vite + Tailwind frontend (`src/`), FastAPI + SQLite backend (`backend/`). The backend serves the built frontend from `dist/`.

## Design principles (from the owner)
- **Mobile first.** The app is almost always used on a phone as an installed PWA. Design and check every change at phone width (~390px) first, then desktop. Respect safe areas (`env(safe-area-inset-*)`), keep tap targets ≥ 40px, and keep input text ≥ 16px so iOS doesn't zoom.
- **Action focused.** The app is opened mostly to log a transaction, so it lands on Transactions. Adding must be fast: amount first, then payee, which fills the rest.
- **Don't hide populated values.** Optional fields can be condensed, but their current values must stay visible.
- Net worth / financial health lives in its own section, not on the landing screen.
- **Theme: Mocha, dark only.** Every colour is a CSS variable in `src/index.css` (`--bg`, `--surface`, `--text`, `--muted`, `--accent`, `--expense`, `--income`, `--transfer`, `--refund`, `--warn`; `*-rgb` triplets for opacity) and the Tailwind names map to them. Don't hard-code hex colours except in the user-pickable palettes (category/tag/project/account colours). Expenses stay red: it's the primary distinction. Sentence case, no tiny uppercase labels. Font: Plus Jakarta Sans.

## Checks
- `npx tsc --noEmit` and `npm run build`
