import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateShift, reconcileWeek, summarizeWeeks, validateEntry, validatePaystub } from './ledger.mjs';

test('a shift combines base wages and tips into effective hourly pay', () => {
  const result = calculateShift({
    id: 'shift-1', date: '2026-11-16', hours: 5.5, tips: 82.5, wage: 15,
  });

  assert.equal(result.basePay, 82.5);
  assert.equal(result.gross, 165);
  assert.equal(result.effectiveHourly, 30);
});

test('weekly hourly pay is weighted by hours and weeks start on Monday', () => {
  const weeks = summarizeWeeks([
    { id: 'a', date: '2026-11-16', hours: 5, tips: 80, wage: 12.5 },
    { id: 'b', date: '2026-11-22', hours: 4, tips: 60, wage: 12.5 },
    { id: 'c', date: '2026-11-23', hours: 6, tips: 90, wage: 12.5 },
  ]);

  assert.equal(weeks.length, 2);
  assert.equal(weeks[0].start, '2026-11-23');
  assert.equal(weeks[0].hours, 6);
  assert.equal(weeks[0].gross, 165);
  assert.equal(weeks[1].start, '2026-11-16');
  assert.equal(weeks[1].hours, 9);
  assert.equal(weeks[1].tips, 140);
  assert.equal(weeks[1].gross, 252.5);
  assert.equal(Math.round(weeks[1].effectiveHourly * 100) / 100, 28.06);
});

test('invalid shift values are rejected before they can enter the ledger', () => {
  const valid = { date: '2026-11-17', hours: 4, tips: 60, wage: 12.5 };

  assert.equal(validateEntry({ ...valid, date: '' }).ok, false);
  assert.equal(validateEntry({ ...valid, hours: 0 }).ok, false);
  assert.equal(validateEntry({ ...valid, hours: Number.NaN }).ok, false);
  assert.equal(validateEntry({ ...valid, tips: -1 }).ok, false);
  assert.equal(validateEntry({ ...valid, wage: -1 }).ok, false);
  assert.equal(validateEntry(valid).ok, true);
});

test('a paystub compares its totals with the shifts from the same week', () => {
  const week = summarizeWeeks([
    { date: '2026-11-16', hours: 5, tips: 80, wage: 13.8 },
    { date: '2026-11-22', hours: 4, tips: 60, wage: 13.8 },
  ])[0];
  const stub = { start: '2026-11-16', hours: 9, tips: 140, gross: 264.2 };

  assert.equal(validatePaystub(stub).ok, true);
  assert.equal(reconcileWeek(week, stub).matches, true);
  assert.deepEqual(reconcileWeek(week, { ...stub, hours: 9.25, gross: 270 }).difference,
    { hours: 0.25, tips: 0, gross: 5.8 });
  assert.equal(validatePaystub({ ...stub, start: '2026-11-17' }).ok, false);
});
