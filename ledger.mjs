function roundCents(value) {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function validDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function mondayOf(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  const daysBack = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - daysBack);
  return date.toISOString().slice(0, 10);
}

export function validateEntry(entry) {
  const errors = {};
  if (!validDate(entry.date)) errors.date = 'Choose a valid date.';
  const startTime = entry.startTime ?? '';
  const endTime = entry.endTime ?? '';
  if (startTime || endTime) {
    if (!startTime || !endTime || shiftDuration(startTime, endTime) === null) {
      errors.times = 'Enter both a valid start and end time.';
    }
  }
  if (!Number.isFinite(entry.hours) || entry.hours <= 0 || entry.hours > 24) {
    errors.hours = 'Enter more than 0 and up to 24 hours.';
  }
  if (!Number.isFinite(entry.tips) || entry.tips < 0) {
    errors.tips = 'Enter 0 or more in tips.';
  }
  if (!Number.isFinite(entry.wage) || entry.wage < 0) {
    errors.wage = 'Enter 0 or more for base hourly wage.';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function shiftDuration(startTime, endTime) {
  const timePattern = /^([01]\d|2[0-3]):([0-5]\d)$/;
  const start = timePattern.exec(startTime);
  const end = timePattern.exec(endTime);
  if (!start || !end) return null;
  const startMinutes = Number(start[1]) * 60 + Number(start[2]);
  const endMinutes = Number(end[1]) * 60 + Number(end[2]);
  const elapsed = (endMinutes - startMinutes + 1440) % 1440;
  return elapsed === 0 ? null : Math.round(elapsed / 60 * 100) / 100;
}

export function calculateShift(entry) {
  const basePay = roundCents(entry.hours * entry.wage);
  const gross = roundCents(basePay + entry.tips);
  return { basePay, gross, effectiveHourly: gross / entry.hours };
}

export function summarizeWeeks(entries) {
  const byStart = new Map();
  for (const entry of entries) {
    const start = mondayOf(entry.date);
    const week = byStart.get(start) ?? { start, hours: 0, tips: 0, basePay: 0, gross: 0, shifts: 0 };
    const shift = calculateShift(entry);
    week.hours += entry.hours;
    week.tips = roundCents(week.tips + entry.tips);
    week.basePay = roundCents(week.basePay + shift.basePay);
    week.gross = roundCents(week.gross + shift.gross);
    week.shifts += 1;
    byStart.set(start, week);
  }
  return [...byStart.values()]
    .map((week) => ({ ...week, effectiveHourly: week.gross / week.hours }))
    .sort((a, b) => b.start.localeCompare(a.start));
}

export function validatePaystub(stub) {
  const errors = {};
  if (!validDate(stub.start) || mondayOf(stub.start) !== stub.start) {
    errors.start = 'Choose a Monday.';
  }
  for (const field of ['hours', 'tips', 'gross']) {
    if (!Number.isFinite(stub[field]) || stub[field] < 0) {
      errors[field] = 'Enter 0 or more.';
    }
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function reconcileWeek(week, stub) {
  if (!week || !stub) return null;
  const difference = {
    hours: Math.round((stub.hours - week.hours) * 100) / 100,
    tips: roundCents(stub.tips - week.tips),
    gross: roundCents(stub.gross - week.gross),
  };
  return {
    difference,
    matches: Object.values(difference).every((value) => value === 0),
  };
}
