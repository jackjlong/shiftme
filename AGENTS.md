# Shift Ledger

This is a small, browser-local shift earnings tool. Keep it dependency-free and focused on completed shifts and Monday–Sunday totals. `README.md` explains the current behavior and how to run it.

- Do not commit paystubs, schedules, real earnings entries, screenshots of real financial data, or exported CSV files.
- Preserve existing browser data. The local storage key is `ship-daily.shift-ledger.v1`; changing it needs a migration.
- Gross pay is a simple estimate: hours × base hourly wage + tips. Effective hourly is gross ÷ hours. It excludes taxes, overtime, and deductions.
- Verify calculation changes with `node --test ledger.test.mjs` and exercise the changed browser flow before calling it done.
- Keep the README short and accurate. Distinguish a tested local tool from a public release.
