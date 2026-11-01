// Finto Google Sheet per collaudare Code.gs in locale (usato da test.js).
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const assert = require('assert');

class Range {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) {
        const v = (this.sheet.data[this.r - 1 + i] || [])[this.c - 1 + j];
        row.push(v === undefined ? '' : this.sheet.evaluate(v));
      }
      out.push(row);
    }
    return out;
  }
  getValue() { return this.getValues()[0][0]; }
  setFormula(f) { this.sheet.put(this.r, this.c, f); return this; }
  clear() { for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.put(this.r + i, this.c + j, ''); return this; }
  setValues(vals) {
    vals.forEach((row, i) => row.forEach((v, j) => this.sheet.put(this.r + i, this.c + j, v)));
    return this;
  }
  setValue(v) { this.sheet.put(this.r, this.c, v); return this; }
  setFormulas(f) { f.forEach((row, i) => row.forEach((v, j) => this.sheet.put(this.r + i, this.c + j, v))); return this; }
  setNumberFormat() { return this; }
  setFontWeight() { return this; }
  setBackground() { return this; }
  setBackgrounds(b) { this.sheet.backgrounds = this.sheet.backgrounds || {}; b.forEach((row, i) => row.forEach((v, j) => { this.sheet.backgrounds[(this.r + i) + ':' + (this.c + j)] = v; })); return this; }
  setRichTextValues(v) { v.forEach((row, i) => row.forEach((x, j) => this.sheet.put(this.r + i, this.c + j, x.link ? { text: x.text, link: x.link } : x.text))); return this; }
  clearContent() { return this.clear(); }
  setDataValidation() { return this; }
}
class Sheet {
  constructor(name) { this.name = name; this.data = []; }
  put(r, c, v) {
    while (this.data.length < r) this.data.push([]);
    this.data[r - 1][c - 1] = v;
  }
  // Simula la lingua del foglio: con locale "punto e virgola" una formula con virgole tra gli argomenti dà #ERROR!, e viceversa.
  evaluate(v) {
    if (typeof v !== 'string' || v.charAt(0) !== '=') return v;
    let inString = false, comma = false, semi = false;
    for (const ch of v) { if (ch === '"') inString = !inString; else if (!inString && ch === ',') comma = true; else if (!inString && ch === ';') semi = true; }
    return (this.semicolonLocale ? comma : semi) ? '#ERROR!' : v;
  }
  getLastRow() {
    for (let i = this.data.length - 1; i >= 0; i--) if ((this.data[i] || []).some((v) => v !== '' && v !== undefined)) return i + 1;
    return 0;
  }
  getName() { return this.name; }
  getMaxRows() { return 1000; }
  getRange(r, c, nr = 1, nc = 1) { return new Range(this, r, c, nr, nc); }
  setFrozenRows() {}
  setConditionalFormatRules(r) { this.rules = r; }
  getBackground(r, c) { return (this.backgrounds || {})[r + ':' + c] || null; }
  setColumnWidth() {}
  clear() { this.data = []; }
}

function makeEnv(opts = {}) {
  const sheets = {};
  const mails = [];
  const alerts = [];
  const ss = {
    getSheetByName: (n) => sheets[n] || null,
    insertSheet: (n) => { const sh = (sheets[n] = new Sheet(n)); sh.semicolonLocale = !!opts.semicolonLocale; return sh; },
    getSpreadsheetTimeZone: () => 'Europe/Rome'
  };
  const sandbox = {
    SpreadsheetApp: {
      flush() {},
      getActive: () => ss,
      getUi: () => ({ createMenu: () => ({ addItem() { return this; }, addToUi() {} }), alert: (m) => alerts.push(m) }),
      newRichTextValue: () => { const b = { text: '', link: null, setText(t) { this.text = t; return this; }, setLinkUrl(u) { this.link = u; return this; }, build() { return { text: this.text, link: this.link }; } }; return b; },
      newConditionalFormatRule: () => { const b = { whenFormulaSatisfied(f) { this.formula = f; return this; }, setBackground() { return this; }, setRanges() { return this; }, build() { return { formula: this.formula }; } }; return b; },
      newDataValidation: () => ({ requireValueInList() { return this; }, build: () => ({}) })
    },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    MailApp: { sendEmail: (to, subject, body) => mails.push({ to, subject, body }) },
    Utilities: {
      formatDate: (d, tz, fmt) => {
        if (fmt === 'dd/MM/yyyy HH:mm') {
          const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(d).map((x) => [x.type, x.value]));
          return p.day + '/' + p.month + '/' + p.year + ' ' + p.hour + ':' + p.minute;
        }
        assert.strictEqual(fmt, 'yyyy-MM-dd');
        return new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(d);
      }
    },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } })
    },
    console
  };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(path.join(__dirname, 'Code.gs'), 'utf8'), sandbox);
  return { sheets, mails, alerts, sandbox, ss };
}

module.exports = { makeEnv };
