# shiftme

Track completed shifts, then compare the week's hours, tips, and gross pay with a paystub.

**Live app:** https://jackjlong.github.io/shiftme/

## Use it

Save your base hourly rate once. For each completed shift, enter its date, hours, and tips. The rate is saved in your browser and attached to new shifts; changing it later does not rewrite older shifts. At the end of a Monday–Sunday week, enter the paystub's hours, tips, and gross pay. shiftme shows the difference between the paystub and the logged shifts.

Entries and paystub totals stay in that browser's local storage. The public site has no account or server database. Data does not sync across browsers or devices, and clearing browser data can erase it. **Export CSV** saves a copy of shift entries; it does not currently include paystub totals.

Gross and hourly figures from logged shifts are estimates before taxes or deductions. Paystubs may include adjustments or pay lines this app does not calculate. The app does not read PDF paystubs automatically.

## Run locally

On a Mac, double-click **Open shiftme.command** and keep its Terminal window open. Or run `python3 serve.py` here and open `http://127.0.0.1:8765/`. Browser storage for the local address is separate from storage on the live site.

## Check

```sh
node --test ledger.test.mjs
```

No package installation is needed. `ledger.mjs` contains the calculations; `app.mjs` handles the interface and browser storage. The tests cover shift pay, weekly totals, input validation, and paystub comparison. Personal paystubs and real earnings are not in this repository.
