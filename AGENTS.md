# shiftme

This is a small public website for logging completed shifts and comparing Monday–Sunday totals with a paystub. Keep it dependency-free. `README.md` explains the current behavior.

- Do not commit paystubs, schedules, real earnings entries, screenshots of real financial data, or exported CSV files.
- Preserve existing browser data. The original shift storage key is `ship-daily.shift-ledger.v1`; the name is kept for compatibility with the first local version. Changing it needs a migration.
- Gross pay is a simple estimate: hours × base hourly wage + tips. Effective hourly is gross ÷ hours. It excludes taxes, overtime, and deductions.
- Verify calculation changes with `node --test ledger.test.mjs` and exercise the changed browser flow before calling it done.
- Keep the README short and accurate. Confirm the public URL after each deployment.
