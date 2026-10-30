# JeetMoney finance tracker

React + Vite + Tailwind frontend (`src/`), FastAPI + SQLite backend (`backend/`). The backend serves the built frontend from `dist/`.

## Design principles (from the owner)
- **Mobile first.** The app is almost always used on a phone as an installed PWA. Design and check every change at phone width (~390px) first, then desktop. Respect safe areas (`env(safe-area-inset-*)`), keep tap targets ≥ 40px, and keep input text ≥ 16px so iOS doesn't zoom.
- **Action focused.** The app is opened mostly to log a transaction, so it lands on Transactions. Adding must be fast: amount first, then payee, which fills the rest.
- **Don't hide populated values.** Optional fields can be condensed, but their current values must stay visible.
- Net worth / financial health lives in its own section, not on the landing screen.

## Checks
- `npx tsc --noEmit` and `npm run build`
