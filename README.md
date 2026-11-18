# shiftme

Track completed shifts, then compare the week's hours, tips, and gross pay with a paystub.

**Live app:** https://jackjlong.github.io/shiftme/

## Use it

Save your base hourly rate once. For each completed shift, enter its date, clock-in and clock-out times, and tips. Hours fill from the times and can be adjusted for unpaid breaks. The rate is attached to each new shift; changing it later does not rewrite older shifts. Older entries without clock times still work.

At the end of a Monday–Sunday week, choose a Gusto earnings statement PDF. shiftme reads its pay period, hours, paycheck and cash tips, gross pay, and server rate in your browser. Review the extracted totals and save them to see paystub minus logged shifts. Manual entry remains available. A PDF for a week with no logged shifts can be saved; the comparison appears after shifts are entered.

Entries and paystub totals stay in that browser's local storage. The PDF file itself is neither uploaded nor saved. The public site has no account or server database. Data does not sync across browsers or devices, and clearing browser data can erase it. **Export CSV** saves a copy of shift entries; it does not currently include paystub totals.

Gross and hourly figures from logged shifts are estimates before taxes or deductions. Paystubs may include adjustments or pay lines this app does not calculate. PDF import supports text-based, single-week Gusto earnings statements like the one used during development. Scanned PDFs and other payroll layouts need manual entry.

## Run locally

On a Mac, double-click **Open shiftme.command** and keep its Terminal window open. Or run `python3 serve.py` here and open `http://127.0.0.1:8765/`. Browser storage for the local address is separate from storage on the live site.

## Check

```sh
node --test ledger.test.mjs
```

No package installation or build step is needed. `ledger.mjs` contains the calculations, `paystub.mjs` parses extracted statement rows, and `app.mjs` handles the interface and browser storage. Mozilla PDF.js 6.5.438 is included under Apache-2.0 in `vendor/pdfjs/`. The seven tests cover shift pay, weekly totals, time and input validation, paystub comparison, and PDF row parsing. Personal paystubs and real earnings are not in this repository.
