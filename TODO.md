# To-do

## Multi-currency accounts
Accounts already have a `currency` field, but every total, chart and balance adds amounts as-is with no conversion.
- Store each transaction in the account's own currency, plus a converted amount (or rate) in the base currency (EUR)
- Cross-currency transfers: different amounts on each side (e.g. 72.57 EUR out of Wise → 5,000 PHP into a cash account)
- Convert to the base currency in summaries, dashboard charts and daily totals
- Then import the non-EUR accounts left out of the Oct 2026 import: Vietnamese Dong, Peru Soles, PH Pesos

## Savings and investments
Money moved into savings or investments is not spending and should not count as an expense.
- Decide how to model it (savings/investment accounts with transfers, goals, holdings, returns)
- Revisit the imported "Savings" category rows once this exists
