import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGustoPaystubRows, rowsFromPdfItems } from './paystub.mjs';

test('a Gusto earnings table yields the current weekly totals', () => {
  const rows = [
    'Pay period: Nov 16, 2026 - Nov 22, 2026 Pay Day: Nov 27, 2026',
    'Employee Gross Earnings',
    'Regular Hours | Server $14.00 9.00 $126.00 $500.00',
    'Paycheck Tips $140.00 $600.00',
    'Cash Tips $5.00 $20.00',
    'Totals 9.00 $271.00 $1,100.00',
    'Federal Tax Deductible Earnings',
  ];
  assert.deepEqual(parseGustoPaystubRows(rows), {
    start: '2026-11-16', end: '2026-11-22', hours: 9, tips: 145, gross: 271, rate: 14,
  });
  assert.throws(() => parseGustoPaystubRows(rows.slice(0, -1)), /earnings table/);
});

test('PDF text items are grouped by visual row and column order', () => {
  const item = (str, x, y) => ({ str, transform: [1, 0, 0, 1, x, y] });
  assert.deepEqual(rowsFromPdfItems([
    item('$271.00', 350, 50), item('Totals', 10, 50), item('Paycheck Tips', 10, 70), item('$140.00', 350, 70),
  ]), ['Paycheck Tips $140.00', 'Totals $271.00']);
});
