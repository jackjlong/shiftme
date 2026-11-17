# Shift Ledger

A laptop tool for tracking shift hours, tips, and estimated gross pay. The code is public; your entries stay in this browser's local storage. No account or paid service is required.

## Use it

On a Mac, double-click **Open Shift Ledger.command**. It starts a local server and opens the page in your default browser. Keep the Terminal window open while using it. Use the same browser each time so it can find your saved entries.

Or, from this folder, run:

```sh
python3 serve.py
```

Open `http://127.0.0.1:8765/` in your laptop browser if it does not open automatically. Enter the shift date, hours worked, tips, and base hourly wage, then select **Save shift**. Use **Edit** or **Delete** to correct an entry. **Export CSV** downloads a spreadsheet-friendly copy.

The page shows estimated gross pay for each shift and totals for Monday–Sunday weeks. Effective hourly pay is gross pay divided by hours. Weekly effective hourly pay uses total weekly gross divided by total weekly hours, so it properly weights shifts of different lengths.

All calculations are estimates before taxes or deductions. The app does not calculate overtime, shift differentials, withholding, or pay-stub reconciliation. Browser storage does not sync between browsers or devices and may be lost if browser data is cleared; export a CSV copy for records you want to keep. CSV import is not implemented.

## Check the calculations

```sh
node --test ledger.test.mjs
```

No package installation is needed. The calculation module is `ledger.mjs`; `app.mjs` handles the interface and browser storage; `styles.css` handles layout.
