const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function isoDate(month, day, year) {
  const monthIndex = months.findIndex((name) => name.toLowerCase() === month.slice(0, 3).toLowerCase());
  if (monthIndex < 0) throw new Error('Could not read the pay period dates.');
  const date = new Date(Date.UTC(Number(year), monthIndex, Number(day)));
  if (date.getUTCMonth() !== monthIndex || date.getUTCDate() !== Number(day)) {
    throw new Error('Could not read the pay period dates.');
  }
  return date.toISOString().slice(0, 10);
}

function firstMoney(row) {
  const match = row.match(/\$([\d,]+\.\d{2})/);
  return match ? Number(match[1].replaceAll(',', '')) : null;
}

export function rowsFromPdfItems(items) {
  const rows = [];
  for (const item of items) {
    const value = item.str?.trim();
    if (!value) continue;
    const x = item.transform?.[4];
    const y = item.transform?.[5];
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    let row = rows.find((candidate) => Math.abs(candidate.y - y) < 2);
    if (!row) {
      row = { y, cells: [] };
      rows.push(row);
    }
    row.cells.push({ x, value });
  }
  return rows.sort((a, b) => b.y - a.y)
    .map((row) => row.cells.sort((a, b) => a.x - b.x).map((cell) => cell.value).join(' '));
}

export function parseGustoPaystubRows(rows) {
  const periodRow = rows.find((row) => /Pay period:/i.test(row));
  const match = periodRow?.match(/Pay period:\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})\s*[-–]\s*([A-Za-z]+)\s+(\d{1,2}),\s*(\d{4})/i);
  if (!match) throw new Error('Could not find the pay period on this PDF.');
  const start = isoDate(match[1], match[2], match[3]);
  const end = isoDate(match[4], match[5], match[6]);
  const firstDay = new Date(`${start}T00:00:00Z`);
  const lastDay = new Date(`${end}T00:00:00Z`);
  if (firstDay.getUTCDay() !== 1 || (lastDay - firstDay) / 86400000 !== 6) {
    throw new Error('This paystub does not cover one Monday–Sunday week.');
  }

  const earningsStart = rows.findIndex((row) => /Employee Gross Earnings/i.test(row));
  const earningsEnd = rows.findIndex((row, index) => index > earningsStart && /Federal Tax Deductible Earnings/i.test(row));
  if (earningsStart < 0 || earningsEnd < 0) throw new Error('Could not find the earnings table on this PDF.');
  const earnings = rows.slice(earningsStart + 1, earningsEnd);
  const totalRow = earnings.find((row) => /^Totals\s/i.test(row));
  const totals = totalRow?.match(/^Totals\s+([\d,]+(?:\.\d+)?)\s+\$([\d,]+\.\d{2})/i);
  const paycheckTips = firstMoney(earnings.find((row) => /^Paycheck Tips\s/i.test(row)) ?? '');
  const cashTips = firstMoney(earnings.find((row) => /^Cash Tips\s/i.test(row)) ?? '') ?? 0;
  if (!totals || paycheckTips === null) throw new Error('Could not find hours, tips, and gross pay on this PDF.');
  const serverRow = earnings.find((row) => /^Regular Hours\s*\|\s*Server\s/i.test(row));
  return {
    start,
    end,
    hours: Number(totals[1].replaceAll(',', '')),
    tips: Math.round((paycheckTips + cashTips) * 100) / 100,
    gross: Number(totals[2].replaceAll(',', '')),
    rate: firstMoney(serverRow ?? ''),
  };
}
