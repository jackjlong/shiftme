import { calculateShift, summarizeWeeks, validateEntry } from './ledger.mjs';

const STORAGE_KEY = 'ship-daily.shift-ledger.v1';
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const hourFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
const shortDateFormat = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' });

const form = document.querySelector('#shift-form');
const fields = {
  date: document.querySelector('#shift-date'),
  hours: document.querySelector('#shift-hours'),
  tips: document.querySelector('#shift-tips'),
  wage: document.querySelector('#shift-wage'),
};
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

const saved = readSavedEntries();
let entries = saved.entries;
let editingId = null;
let storageLocked = saved.locked;
fields.date.value = localToday();
if (entries.length > 0) fields.wage.value = String(entries.at(-1).wage);

function showStorageMessage(text) {
  message.textContent = text;
  message.hidden = false;
}

if (storageLocked) {
  showStorageMessage('Saved data could not be read. The app has not overwritten it. Export or repair the browser data before adding more shifts.');
  [...form.elements].forEach((element) => { element.disabled = true; });
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    message.hidden = true;
    return true;
  } catch {
    showStorageMessage('This browser could not save your shifts. Entries are visible for this session only. Export CSV to keep a copy.');
    return false;
  }
}

function setErrors(errors) {
  for (const [key, input] of Object.entries(fields)) {
    const error = errors[key] ?? '';
    input.setAttribute('aria-invalid', String(Boolean(error)));
    input.setAttribute('aria-describedby', error ? `${key}-error` : '');
    document.querySelector(`#${key}-error`).textContent = error;
  }
}

function formEntry() {
  return {
    date: fields.date.value,
    hours: fields.hours.value.trim() === '' ? Number.NaN : Number(fields.hours.value),
    tips: fields.tips.value.trim() === '' ? Number.NaN : Number(fields.tips.value),
    wage: fields.wage.value.trim() === '' ? Number.NaN : Number(fields.wage.value),
  };
}

function resetForm() {
  editingId = null;
  fields.date.value = localToday();
  fields.hours.value = '';
  fields.tips.value = '';
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
    weekList.append(row);
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
    for (const text of [dateFormat.format(dateObject(entry.date)), hourFormat.format(entry.hours), currency.format(entry.tips), currency.format(entry.wage), currency.format(shift.gross), currency.format(shift.effectiveHourly)]) {
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

function render() {
  const weeks = summarizeWeeks(entries);
  renderSummary(weeks);
  renderWeeks(weeks);
  renderShifts();
  exportButton.disabled = entries.length === 0;
}

form.addEventListener('submit', (event) => {
  event.preventDefault();
  if (storageLocked) return;
  const input = formEntry();
  const validation = validateEntry(input);
  setErrors(validation.errors);
  if (!validation.ok) {
    status.textContent = 'Check the highlighted fields.';
    fields[Object.keys(validation.errors)[0]].focus();
    return;
  }
  if (editingId) {
    entries = entries.map((entry) => entry.id === editingId ? { ...input, id: editingId } : entry);
  } else {
    entries = [...entries, { ...input, id: crypto.randomUUID() }];
  }
  const action = editingId ? 'updated' : 'saved';
  const persisted = save();
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
    for (const key of Object.keys(fields)) fields[key].value = String(entry[key]);
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
    const persisted = save();
    render();
    status.textContent = persisted ? 'Shift deleted.' : 'Shift deleted in this tab only. Export CSV to keep a copy.';
  }
});

exportButton.addEventListener('click', () => {
  const header = 'date,hours,tips,base_hourly_wage,base_pay,estimated_gross,effective_hourly';
  const lines = [...entries].sort((a, b) => a.date.localeCompare(b.date)).map((entry) => {
    const shift = calculateShift(entry);
    return [entry.date, entry.hours, entry.tips, entry.wage, shift.basePay, shift.gross, shift.effectiveHourly.toFixed(2)].join(',');
  });
  const blob = new Blob([[header, ...lines].join('\n') + '\n'], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `shift-ledger-${localToday()}.csv`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  status.textContent = 'CSV export downloaded.';
});

render();
