import { calculateShift, reconcileWeek, shiftDuration, summarizeWeeks, validateEntry, validatePaystub } from './ledger.mjs';
import { parseGustoPaystubRows, rowsFromPdfItems } from './paystub.mjs';

const STORAGE_KEY = 'ship-daily.shift-ledger.v1';
const RATE_KEY = 'ship-daily.shift-ledger.rate.v1';
const STUB_KEY = 'ship-daily.shift-ledger.paystubs.v1';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const hourFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });
const shiftDateFormat = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

const form = document.querySelector('#shift-form');
const fields = {
  date: document.querySelector('#shift-date'),
  startTime: document.querySelector('#shift-start'),
  endTime: document.querySelector('#shift-end'),
  hours: document.querySelector('#shift-hours'),
  tips: document.querySelector('#shift-tips'),
};
const rateForm = document.querySelector('#rate-form');
const rateInput = document.querySelector('#base-rate');
const rateStatus = document.querySelector('#rate-status');
const stubForm = document.querySelector('#stub-form');
const stubFields = {
  start: document.querySelector('#stub-start'),
  hours: document.querySelector('#stub-hours'),
  tips: document.querySelector('#stub-tips'),
  gross: document.querySelector('#stub-gross'),
};
const stubStatus = document.querySelector('#stub-status');
const stubResult = document.querySelector('#stub-result');
const pdfInput = document.querySelector('#stub-pdf');
const pdfStatus = document.querySelector('#pdf-status');
const message = document.querySelector('#storage-message');
const status = document.querySelector('#form-status');
const cancelButton = document.querySelector('#cancel-button');
const exportButton = document.querySelector('#export-button');
const weekList = document.querySelector('#week-list');
const shiftRows = document.querySelector('#shift-rows');

function localToday() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function dateObject(dateString) {
  const [year, month, day] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

function rangeFor(startString) {
  const start = dateObject(startString);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return `${shortDateFormat.format(start)} – ${shortDateFormat.format(end)}`;
}

function readSavedEntries() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { entries: [], locked: false };
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.some((entry) => !entry || typeof entry.id !== 'string' || !validateEntry(entry).ok)) {
      throw new Error('Saved data has an unexpected format.');
    }
    return { entries: parsed, locked: false };
  } catch {
    return { entries: [], locked: true };
  }
}

function readSavedRate(entries) {
  const raw = localStorage.getItem(RATE_KEY);
  if (raw !== null) {
    const rate = Number(raw);
    if (!Number.isFinite(rate) || rate < 0) throw new Error('Invalid saved rate.');
    return rate;
  }
  return entries.length ? entries.at(-1).wage : null;
}

function readSavedStubs() {
  const raw = localStorage.getItem(STUB_KEY);
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) ||
      Object.entries(parsed).some(([start, stub]) => start !== stub.start || !validatePaystub(stub).ok)) {
    throw new Error('Invalid saved paystub totals.');
  }
  return parsed;
}

const saved = readSavedEntries();
let entries = saved.entries;
let editingId = null;
let lastAutoHours = null;
let storageLocked = saved.locked;
let rate = null;
let paystubs = {};
let pendingStub = null;
try {
  rate = readSavedRate(entries);
  paystubs = readSavedStubs();
} catch {
  storageLocked = true;
}
fields.date.value = localToday();
if (rate !== null) rateInput.value = String(rate);

function showStorageMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

if (storageLocked) {
  showStorageMessage('Saved data could not be read. The app has not overwritten it. Export or repair the browser data before adding more shifts.');
  [...form.elements].forEach((element) => { element.disabled = true; });
  [...rateForm.elements, ...stubForm.elements].forEach((element) => { element.disabled = true; });
  pdfInput.disabled = true;
}

function save(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    message.hidden = true;
    return true;
  } catch {
    showStorageMessage('This browser could not save your changes. They are visible for this session only.');
    return false;
  }
}

function setErrors(errors) {
  for (const [key, input] of Object.entries(fields)) {
    const isTime = key === 'startTime' || key === 'endTime';
    const error = isTime ? (errors.times ?? '') : (errors[key] ?? '');
    input.setAttribute('aria-invalid', String(Boolean(error)));
    input.setAttribute('aria-describedby', error ? (isTime ? 'times-error' : `${key}-error`) : '');
    if (!isTime || key === 'endTime') document.querySelector(`#${isTime ? 'times' : key}-error`).textContent = error;
  }
}

function formEntry() {
  const original = entries.find((entry) => entry.id === editingId);
  return {
    date: fields.date.value,
    startTime: fields.startTime.value,
    endTime: fields.endTime.value,
    hours: fields.hours.value.trim() === '' ? Number.NaN : Number(fields.hours.value),
    tips: fields.tips.value.trim() === '' ? Number.NaN : Number(fields.tips.value),
    wage: original?.wage ?? rate ?? Number.NaN,
  };
}

function resetForm() {
  editingId = null;
  fields.date.value = localToday();
  fields.startTime.value = '';
  fields.endTime.value = '';
  fields.hours.value = '';
  fields.tips.value = '';
  lastAutoHours = null;
  document.querySelector('#form-title').textContent = 'Add a shift';
  document.querySelector('#save-button').firstChild.textContent = 'Save shift ';
  cancelButton.hidden = true;
  setErrors({});
}

function stat(label, value) {
  const wrapper = document.createElement('div');
  wrapper.className = 'week-stat';
  const name = document.createElement('span');
  name.textContent = label;
  const amount = document.createElement('strong');
  amount.textContent = value;
  wrapper.append(name, amount);
  return wrapper;
}

function renderWeeks(weeks) {
  weekList.replaceChildren();
  if (weeks.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'empty-state';
    empty.textContent = 'Your first saved shift will appear here.';
    weekList.append(empty);
    return;
  }
  for (const week of weeks) {
    const row = document.createElement('article');
    row.className = 'week-row';
    const range = document.createElement('div');
    range.className = 'week-range';
    range.textContent = rangeFor(week.start);
    const count = document.createElement('span');
    count.className = 'week-count';
    count.textContent = `${week.shifts} ${week.shifts === 1 ? 'shift' : 'shifts'}`;
    range.append(count);
    row.append(range, stat('Hours', hourFormat.format(week.hours)), stat('Tips', currency.format(week.tips)), stat('Est. gross', currency.format(week.gross)), stat('Effective / hr', currency.format(week.effectiveHourly)));
    if (paystubs[week.start]) {
      const marker = document.createElement('span');
      marker.className = 'stub-marker';
      marker.textContent = 'Paystub saved';
      range.append(marker);
    }
    weekList.append(row);
  }
}

function signed(value, format) {
  return `${value > 0 ? '+' : ''}${format(value)}`;
}

function renderReconciliation(weeks) {
  const selected = stubFields.start.value;
  stubFields.start.replaceChildren();
  const starts = [...new Set([...weeks.map((week) => week.start), ...Object.keys(paystubs), ...(pendingStub ? [pendingStub.start] : [])])]
    .sort((a, b) => b.localeCompare(a));
  for (const start of starts) {
    const option = document.createElement('option');
    option.value = start;
    option.textContent = rangeFor(start);
    stubFields.start.append(option);
  }
  stubFields.start.value = starts.includes(selected) ? selected : (starts[0] ?? '');
  stubFields.start.disabled = starts.length === 0 || storageLocked;
  stubForm.querySelector('button').disabled = starts.length === 0 || storageLocked;
  const week = weeks.find((item) => item.start === stubFields.start.value);
  const imported = pendingStub?.start === stubFields.start.value;
  const stub = imported ? pendingStub : paystubs[stubFields.start.value];
  stubResult.replaceChildren();
  if (!stubFields.start.value) {
    stubResult.textContent = 'Log a shift or choose a paystub PDF to begin.';
    return;
  }
  for (const name of ['hours', 'tips', 'gross']) {
    stubFields[name].value = stub ? String(stub[name]) : '';
  }
  if (!stub) {
    stubResult.textContent = 'No paystub totals saved for this week yet.';
    return;
  }
  if (!week) {
    stubResult.textContent = imported ? 'PDF totals are ready to save. No shifts are logged for this week yet.' : 'Paystub saved. No shifts are logged for this week yet.';
    return;
  }
  const comparison = reconcileWeek(week, stub);
  const heading = document.createElement('strong');
  heading.textContent = imported ? 'PDF totals ready to save' : comparison.matches ? 'Logged totals match the paystub.' : 'Paystub minus logged shifts';
  const details = document.createElement('p');
  details.textContent = `Hours ${signed(comparison.difference.hours, hourFormat.format)} · Tips ${signed(comparison.difference.tips, currency.format)} · Gross ${signed(comparison.difference.gross, currency.format)}`;
  stubResult.append(heading, details);
  if (!comparison.matches || imported) {
    const note = document.createElement('small');
    note.textContent = imported ? 'Review the extracted totals above, then save them.' : 'Differences may reflect missing shifts, adjusted hours or tips, or other pay lines.';
    stubResult.append(note);
  }
}

function renderSummary(weeks) {
  const latest = weeks[0];
  document.querySelector('#latest-range').textContent = latest ? rangeFor(latest.start) : 'No shifts yet';
  document.querySelector('#latest-gross').textContent = currency.format(latest?.gross ?? 0);
  document.querySelector('#latest-hours').textContent = hourFormat.format(latest?.hours ?? 0);
  document.querySelector('#latest-tips').textContent = currency.format(latest?.tips ?? 0);
  document.querySelector('#latest-base').textContent = currency.format(latest?.basePay ?? 0);
  document.querySelector('#latest-effective').textContent = currency.format(latest?.effectiveHourly ?? 0);
}

function actionButton(label, action, entry) {
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = label;
  button.dataset.action = action;
  button.dataset.id = entry.id;
  button.setAttribute('aria-label', `${label} shift on ${dateFormat.format(dateObject(entry.date))}`);
  return button;
}

function formattedTime(time) {
  const [hour, minute] = time.split(':').map(Number);
  const period = hour < 12 ? 'am' : 'pm';
  return { clock: `${hour % 12 || 12}:${String(minute).padStart(2, '0')}`, period };
}

function timeRange(entry) {
  if (!entry.startTime || !entry.endTime) return 'Time not recorded';
  const start = formattedTime(entry.startTime);
  const end = formattedTime(entry.endTime);
  return `${start.clock}${start.period === end.period ? '' : ` ${start.period}`} to ${end.clock} ${end.period}`;
}

function renderShifts() {
  shiftRows.replaceChildren();
  if (entries.length === 0) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.className = 'empty-cell';
    cell.colSpan = 7;
    cell.textContent = 'No shifts saved yet. Add one above to start your ledger.';
    row.append(cell);
    shiftRows.append(row);
    return;
  }
  const sorted = [...entries].sort((a, b) => b.date.localeCompare(a.date));
  for (const entry of sorted) {
    const shift = calculateShift(entry);
    const row = document.createElement('tr');
    const dateCell = document.createElement('td');
    const day = document.createElement('strong');
    day.textContent = shiftDateFormat.format(dateObject(entry.date));
    const times = document.createElement('span');
    times.className = 'shift-times';
    times.textContent = timeRange(entry);
    dateCell.append(day, times);
    row.append(dateCell);
    for (const text of [hourFormat.format(entry.hours), currency.format(entry.tips), currency.format(entry.wage), currency.format(shift.gross), currency.format(shift.effectiveHourly)]) {
      const cell = document.createElement('td');
      cell.textContent = text;
      row.append(cell);
    }
    const actionsCell = document.createElement('td');
    const actions = document.createElement('div');
    actions.className = 'row-actions';
    actions.append(actionButton('Edit', 'edit', entry), actionButton('Delete', 'delete', entry));
    actionsCell.append(actions);
    row.append(actionsCell);
    shiftRows.append(row);
  }
}

for (const field of [fields.startTime, fields.endTime]) {
  field.addEventListener('input', () => {
    const duration = shiftDuration(fields.startTime.value, fields.endTime.value);
    if (duration !== null && (fields.hours.value === '' || fields.hours.value === lastAutoHours)) {
      fields.hours.value = String(duration);
      lastAutoHours = fields.hours.value;
    }
  });
}
fields.hours.addEventListener('input', () => { lastAutoHours = null; });

function render() {
  const weeks = summarizeWeeks(entries);
  renderSummary(weeks);
  renderWeeks(weeks);
  renderReconciliation(weeks);
  renderShifts();
  exportButton.disabled = entries.length === 0;
}

rateForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (storageLocked) return;
  const value = rateInput.value.trim() === '' ? Number.NaN : Number(rateInput.value);
  if (!Number.isFinite(value) || value < 0) {
    rateStatus.textContent = 'Enter a valid hourly rate of 0 or more.';
    rateInput.focus();
    return;
  }
  rate = value;
  const persisted = save(RATE_KEY, rate);
  rateStatus.textContent = persisted ? 'Base rate saved for future shifts.' : 'Base rate saved in this tab only.';
});

stubFields.start.addEventListener('change', () => {
  renderReconciliation(summarizeWeeks(entries));
  stubStatus.textContent = '';
});

pdfInput.addEventListener('change', async () => {
  const file = pdfInput.files?.[0];
  if (!file || storageLocked) return;
  if (file.size > 10_000_000) {
    pdfStatus.textContent = 'Choose a PDF smaller than 10 MB.';
    return;
  }
  pdfStatus.textContent = 'Reading PDF in this browser…';
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    if (new TextDecoder().decode(data.slice(0, 5)) !== '%PDF-') throw new Error('This file is not a PDF.');
    const pdfjs = await import('./vendor/pdfjs/pdf.min.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs', import.meta.url).href;
    const loadingTask = pdfjs.getDocument({ data });
    let parsed;
    try {
      const pdf = await loadingTask.promise;
      const rows = [];
      for (let pageNumber = 1; pageNumber <= Math.min(pdf.numPages, 3); pageNumber++) {
        const page = await pdf.getPage(pageNumber);
        rows.push(...rowsFromPdfItems((await page.getTextContent()).items));
      }
      parsed = parseGustoPaystubRows(rows);
    } finally {
      await loadingTask.destroy();
    }
    if (!validatePaystub(parsed).ok) throw new Error('Could not validate the extracted totals.');
    pendingStub = parsed;
    renderReconciliation(summarizeWeeks(entries));
    stubFields.start.value = parsed.start;
    renderReconciliation(summarizeWeeks(entries));
    pdfStatus.textContent = `Read ${rangeFor(parsed.start)} from the PDF${parsed.rate === null ? '' : `; server rate ${currency.format(parsed.rate)}/hr`}. Review the totals, then save.`;
    stubStatus.textContent = '';
  } catch (error) {
    pdfStatus.textContent = `${error.message} You can enter the paystub totals below instead.`;
  }
});

stubForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (storageLocked) return;
  const stub = { start: stubFields.start.value };
  for (const name of ['hours', 'tips', 'gross']) {
    const raw = stubFields[name].value.trim();
    stub[name] = raw === '' ? Number.NaN : Number(raw);
  }
  const validation = validatePaystub(stub);
  for (const [name, input] of Object.entries(stubFields)) {
    const error = validation.errors[name] ?? '';
    input.setAttribute('aria-invalid', String(Boolean(error)));
    document.querySelector(`#${name === 'start' ? 'start' : `stub-${name}`}-error`).textContent = error;
  }
  if (!validation.ok) {
    stubStatus.textContent = 'Check the highlighted paystub fields.';
    stubFields[Object.keys(validation.errors)[0]].focus();
    return;
  }
  if (rate === null && pendingStub?.start === stub.start && pendingStub.rate !== null) {
    rate = pendingStub.rate;
    rateInput.value = String(rate);
    save(RATE_KEY, rate);
    rateStatus.textContent = 'Base rate saved from your paystub.';
  }
  pendingStub = null;
  paystubs[stub.start] = stub;
  const persisted = save(STUB_KEY, paystubs);
  render();
  stubStatus.textContent = persisted ? 'Paystub totals saved.' : 'Paystub totals saved in this tab only.';
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (storageLocked) return;
  const input = formEntry();
  const validation = validateEntry(input);
  setErrors(validation.errors);
  if (!validation.ok) {
    status.textContent = validation.errors.wage ? 'Save your base hourly rate before adding a shift.' : 'Check the highlighted fields.';
    (validation.errors.times ? fields.startTime : fields[Object.keys(validation.errors)[0]] ?? rateInput).focus();
    return;
  }
  if (editingId) {
    entries = entries.map((entry) => entry.id === editingId ? { ...input, id: editingId } : entry);
  } else {
    entries = [...entries, { ...input, id: crypto.randomUUID() }];
  }
  const action = editingId ? 'updated' : 'saved';
  const persisted = save(STORAGE_KEY, entries);
  resetForm();
  render();
  status.textContent = persisted ? `Shift ${action}.` : `Shift ${action} in this tab only. Export CSV to keep a copy.`;
  fields.hours.focus();
});

cancelButton.addEventListener('click', () => {
  resetForm();
  status.textContent = 'Edit cancelled.';
});

shiftRows.addEventListener('click', (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || storageLocked) return;
  const entry = entries.find((item) => item.id === button.dataset.id);
  if (!entry) return;
  if (button.dataset.action === 'edit') {
    editingId = entry.id;
    for (const key of Object.keys(fields)) fields[key].value = String(entry[key] ?? '');
    lastAutoHours = null;
    document.querySelector('#form-title').textContent = 'Edit shift';
    document.querySelector('#save-button').firstChild.textContent = 'Save changes ';
    cancelButton.hidden = false;
    setErrors({});
    status.textContent = `Editing ${dateFormat.format(dateObject(entry.date))}.`;
    form.scrollIntoView({ behavior: 'smooth', block: 'center' });
    fields.hours.focus();
  } else if (button.dataset.action === 'delete' && confirm(`Delete the shift on ${dateFormat.format(dateObject(entry.date))}?`)) {
    entries = entries.filter((item) => item.id !== entry.id);
    if (editingId === entry.id) resetForm();
    const persisted = save(STORAGE_KEY, entries);
    render();
    status.textContent = persisted ? 'Shift deleted.' : 'Shift deleted in this tab only. Export CSV to keep a copy.';
  }
});

exportButton.addEventListener('click', () => {
  const header = 'date,start_time,end_time,hours,tips,base_hourly_wage,base_pay,estimated_gross,effective_hourly';
  const lines = [...entries].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => {
    const shift = calculateShift(entry);
    return [entry.date, entry.startTime ?? '', entry.endTime ?? '', entry.hours, entry.tips, entry.wage, shift.basePay, shift.gross, shift.effectiveHourly.toFixed(2)].join(',');
  });
  const blob = new Blob([[header, ...lines].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shiftme-${localToday()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'CSV export downloaded.';
});

render();
