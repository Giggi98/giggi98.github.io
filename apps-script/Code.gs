/**
 * Backend RSVP di luciegigi.it: vive dentro il Google Sheet degli invitati.
 * Istruzioni di installazione in apps-script/README.md.
 *
 * Fogli:
 *   Invitati   una riga per persona (la compilate voi, tranne le colonne grigie)
 *   Messaggi   un messaggio per invito (scritto dal sito)
 *   Config     scadenza, IBAN, email di notifica
 *   Riepilogo  conteggi automatici
 *
 * Il sito parla con questo script in due modi:
 *   GET  ?action=invite&code=XXXXXX   restituisce l'invito (e l'IBAN, solo con codice valido)
 *   POST {action:'rsvp', code, people:[...], message}   salva la risposta
 */

var SHEET_GUESTS = 'Invitati';
var SHEET_MESSAGES = 'Messaggi';
var SHEET_CONFIG = 'Config';
var SHEET_SUMMARY = 'Riepilogo';

var GUEST_HEADERS = ['ID', 'Codice', 'Invito', 'Lingua', 'Nome', 'Bambino', 'Risposta', 'Dieta', 'Allergie', 'Aggiornato', 'Link'];
var COL = { ID: 0, CODE: 1, INVITE: 2, LANG: 3, NAME: 4, CHILD: 5, RESP: 6, DIET: 7, ALLERGY: 8, UPDATED: 9, LINK: 10 };

var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente I, O, 0, 1: si confondono
var CODE_LENGTH = 6;

var DIET_TO_LABEL = { none: 'Nessuna', vegetarian: 'Vegetariano', vegan: 'Vegano' };
var LABEL_TO_DIET = { nessuna: 'none', vegetariano: 'vegetarian', vegano: 'vegan' };

var CONFIG_DEFAULTS = [
  ['scadenza_rsvp', '2027-04-30', 'Ultimo giorno per rispondere o modificare (AAAA-MM-GG)'],
  ['email_notifica', '', 'Email che riceve un avviso a ogni risposta (vuoto = nessuna)'],
  ['notifica_attiva', 'SI', 'SI o NO'],
  ['sito_url', 'https://luciegigi.it/', 'Indirizzo del sito, usato per i link personali'],
  ['intestatario', '', 'Intestatario del conto per la lista nozze'],
  ['iban', '', 'IBAN: compare sul sito solo a chi ha un codice invito valido'],
  ['causale', '', 'Causale suggerita per il bonifico (facoltativa)']
];

/* ───────────── Menu nel foglio ───────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Matrimonio')
    .addItem('1. Prepara i fogli', 'setup')
    .addItem('2. Genera codici e link', 'generateCodes')
    .addToUi();
}

function setup() {
  var ss = SpreadsheetApp.getActive();

  var guests = ss.getSheetByName(SHEET_GUESTS) || ss.insertSheet(SHEET_GUESTS);
  if (guests.getLastRow() === 0) {
    guests.getRange(1, 1, 1, GUEST_HEADERS.length).setValues([GUEST_HEADERS]).setFontWeight('bold').setBackground('#d9e8f0');
    guests.setFrozenRows(1);
    guests.getRange(2, 1, 1, 6).setValues([['', '', 'Famiglia Esempio', 'it', 'Mario Esempio', '']]);
    guests.getRange(3, 1, 1, 6).setValues([['', '', 'Famiglia Esempio', 'it', 'Giulia Esempio', '']]);
    guests.getRange(4, 1, 1, 6).setValues([['', '', 'Famiglia Esempio', 'it', 'Luca Esempio', 'Sì']]);
  }
  // Allergie e messaggi sono testo libero: formato "testo" così nessun valore viene letto come formula.
  guests.getRange(2, COL.ALLERGY + 1, 1000, 1).setNumberFormat('@');
  guests.getRange(2, COL.LANG + 1, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['it', 'en'], true).build());

  var messages = ss.getSheetByName(SHEET_MESSAGES) || ss.insertSheet(SHEET_MESSAGES);
  if (messages.getLastRow() === 0) {
    messages.getRange(1, 1, 1, 4).setValues([['Codice', 'Invito', 'Messaggio', 'Aggiornato']]).setFontWeight('bold').setBackground('#d9e8f0');
    messages.setFrozenRows(1);
    messages.getRange(2, 3, 1000, 1).setNumberFormat('@');
  }

  var config = ss.getSheetByName(SHEET_CONFIG) || ss.insertSheet(SHEET_CONFIG);
  if (config.getLastRow() === 0) {
    config.getRange(1, 1, 1, 3).setValues([['Chiave', 'Valore', 'Cosa è']]).setFontWeight('bold').setBackground('#d9e8f0');
    config.getRange(2, 1, CONFIG_DEFAULTS.length, 3).setValues(CONFIG_DEFAULTS);
    config.getRange(2, 2, CONFIG_DEFAULTS.length, 1).setNumberFormat('@');
    config.setColumnWidth(1, 160);
    config.setColumnWidth(2, 280);
    config.setColumnWidth(3, 420);
  }

  var summary = ss.getSheetByName(SHEET_SUMMARY) || ss.insertSheet(SHEET_SUMMARY);
  summary.clear();
  var G = SHEET_GUESTS + '!';
  summary.getRange(1, 1, 8, 2).setFormulas([
    ['Persone invitate', '=COUNTA(' + G + 'E2:E)'],
    ['Confermate', '=COUNTIF(' + G + 'G2:G,"Sì")'],
    ['Non vengono', '=COUNTIF(' + G + 'G2:G,"No")'],
    ['Senza risposta', '=B1-B2-B3'],
    ['Menù bimbi (confermati)', '=COUNTIFS(' + G + 'F2:F,"Sì",' + G + 'G2:G,"Sì")'],
    ['Vegetariani (confermati)', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'H2:H,"Vegetariano")'],
    ['Vegani (confermati)', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'H2:H,"Vegano")'],
    ['Con allergie o intolleranze', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'I2:I,"<>")']
  ]);
  summary.getRange(1, 1, 8, 1).setFontWeight('bold');
  summary.setColumnWidth(1, 240);

  SpreadsheetApp.getUi().alert('Fogli pronti. Compila Config e Invitati, poi scegli "Genera codici e link" dal menu Matrimonio.');
}

/**
 * Assegna un codice a ogni invito che non ce l'ha (tutte le persone con lo stesso nome di invito
 * condividono il codice), un ID a ogni persona e scrive il link personale.
 */
function generateCodes() {
  var ss = SpreadsheetApp.getActive();
  var sheet = ss.getSheetByName(SHEET_GUESTS);
  var rows = readGuests(sheet);
  var siteUrl = normalizeSiteUrl(readConfig(ss).sito_url);

  var codeByInvite = {};
  var used = {};
  var maxId = 0;
  rows.forEach(function (r) {
    var code = clean(r.values[COL.CODE], 20).toUpperCase();
    var invite = clean(r.values[COL.INVITE], 200);
    if (code) { used[code] = true; if (invite && !codeByInvite[invite]) codeByInvite[invite] = code; }
    var m = /^P(\d+)$/.exec(String(r.values[COL.ID]));
    if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
  });

  // Codici come testo: un codice tipo 2E4567 verrebbe altrimenti letto come numero.
  sheet.getRange(2, COL.CODE + 1, Math.max(sheet.getMaxRows() - 1, 1), 1).setNumberFormat('@');

  var newCodes = 0, newIds = 0;
  rows.forEach(function (r) {
    var invite = clean(r.values[COL.INVITE], 200);
    var name = clean(r.values[COL.NAME], 200);
    if (!invite && !name) return;

    var code = clean(r.values[COL.CODE], 20).toUpperCase();
    if (!code && invite) {
      code = codeByInvite[invite];
      if (!code) {
        do { code = randomCode(); } while (used[code]);
        used[code] = true;
        codeByInvite[invite] = code;
        newCodes++;
      }
    }

    var id = String(r.values[COL.ID] || '');
    if (!id) { id = 'P' + pad(++maxId, 4); newIds++; }

    sheet.getRange(r.row, COL.ID + 1).setValue(id);
    sheet.getRange(r.row, COL.CODE + 1).setValue(code);
    if (code) sheet.getRange(r.row, COL.LINK + 1).setValue(siteUrl + '?invito=' + code);
  });

  SpreadsheetApp.getUi().alert('Fatto: ' + newCodes + ' nuovi codici, ' + newIds + ' nuove persone. I link sono nell\'ultima colonna.');
}

/* ───────────── Web app ───────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'invite') return json(getInvite(p.code));
  return json({ ok: true, service: 'rsvp' });
}

function doPost(e) {
  var body;
  try {
    body = JSON.parse(e.postData.contents);
  } catch (err) {
    return json({ ok: false, error: 'invalid_data' });
  }
  if (body && body.action === 'rsvp') return json(saveRsvp(body));
  return json({ ok: false, error: 'invalid_data' });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ───────────── Logica ───────────── */

function getInvite(rawCode) {
  var code = normalizeCode(rawCode);
  if (!code) return { ok: false, error: 'invalid_code' };

  var ss = SpreadsheetApp.getActive();
  var rows = readGuests(ss.getSheetByName(SHEET_GUESTS)).filter(function (r) {
    return String(r.values[COL.CODE]).toUpperCase() === code;
  });
  if (!rows.length) return { ok: false, error: 'invalid_code' };

  var cfg = readConfig(ss);
  var tz = ss.getSpreadsheetTimeZone();
  var first = rows[0].values;
  var answeredAt = null;

  var people = rows.map(function (r) {
    var v = r.values;
    var updated = v[COL.UPDATED];
    if (updated instanceof Date && (!answeredAt || updated > answeredAt)) answeredAt = updated;
    var resp = String(v[COL.RESP]).trim().toLowerCase();
    return {
      id: String(v[COL.ID]),
      name: clean(v[COL.NAME], 200),
      child: isYes(v[COL.CHILD]),
      attending: resp === 'sì' || resp === 'si' ? 'yes' : (resp === 'no' ? 'no' : null),
      diet: LABEL_TO_DIET[String(v[COL.DIET]).trim().toLowerCase()] || 'none',
      allergies: clean(v[COL.ALLERGY], 300)
    };
  });

  var deadline = dateString(cfg.scadenza_rsvp, tz);
  var gift = cfg.iban ? { iban: String(cfg.iban), holder: String(cfg.intestatario || ''), reason: String(cfg.causale || '') } : null;

  return {
    ok: true,
    invite: {
      greeting: clean(first[COL.INVITE], 200),
      lang: String(first[COL.LANG]).trim().toLowerCase() === 'en' ? 'en' : 'it',
      people: people,
      message: readMessage(ss, code),
      answeredAt: answeredAt ? answeredAt.toISOString() : null,
      deadline: deadline,
      closed: isClosed(deadline, tz),
      gift: gift
    }
  };
}

function saveRsvp(body) {
  var code = normalizeCode(body.code);
  if (!code) return { ok: false, error: 'invalid_code' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) { return { ok: false, error: 'busy' }; }

  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(SHEET_GUESTS);
    var rows = readGuests(sheet).filter(function (r) {
      return String(r.values[COL.CODE]).toUpperCase() === code;
    });
    if (!rows.length) return { ok: false, error: 'invalid_code' };

    var cfg = readConfig(ss);
    var tz = ss.getSpreadsheetTimeZone();
    if (isClosed(dateString(cfg.scadenza_rsvp, tz), tz)) return { ok: false, error: 'closed' };

    // Il sito deve rispondere per tutte e sole le persone dell'invito.
    var answers = {};
    var list = Array.isArray(body.people) ? body.people : [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i] || {};
      var attending = a.attending;
      var diet = a.diet || 'none';
      if (!a.id || (attending !== 'yes' && attending !== 'no') || !DIET_TO_LABEL[diet]) return { ok: false, error: 'invalid_data' };
      answers[String(a.id)] = {
        attending: attending,
        diet: attending === 'yes' ? diet : 'none',
        allergies: attending === 'yes' ? clean(a.allergies, 300) : ''
      };
    }
    var ids = rows.map(function (r) { return String(r.values[COL.ID]); });
    if (Object.keys(answers).length !== ids.length || ids.some(function (id) { return !answers[id]; })) {
      return { ok: false, error: 'invalid_data' };
    }

    var message = cleanMultiline(body.message, 1000);
    var now = new Date();
    var before = rows.some(function (r) { return r.values[COL.UPDATED] instanceof Date; });

    rows.forEach(function (r) {
      var ans = answers[String(r.values[COL.ID])];
      // Risposta, dieta e allergie come testo (nessun valore letto come formula); la data resta una data vera.
      var text = sheet.getRange(r.row, COL.RESP + 1, 1, 3);
      text.setNumberFormat('@');
      text.setValues([[ans.attending === 'yes' ? 'Sì' : 'No', DIET_TO_LABEL[ans.diet], ans.allergies]]);
      var stamp = sheet.getRange(r.row, COL.UPDATED + 1);
      stamp.setNumberFormat('dd/MM/yyyy HH:mm');
      stamp.setValue(now);
    });
    writeMessage(ss, code, clean(rows[0].values[COL.INVITE], 200), message, now);

    notify(cfg, rows, answers, message, before);
    return { ok: true, answeredAt: now.toISOString() };
  } finally {
    lock.releaseLock();
  }
}

function notify(cfg, rows, answers, message, isUpdate) {
  try {
    var to = String(cfg.email_notifica || '').trim();
    if (!to || String(cfg.notifica_attiva || 'SI').trim().toUpperCase() !== 'SI') return;
    var invite = clean(rows[0].values[COL.INVITE], 200);
    var yes = 0, no = 0;
    var lines = rows.map(function (r) {
      var a = answers[String(r.values[COL.ID])];
      if (a.attending === 'yes') yes++; else no++;
      var extra = [];
      if (a.diet !== 'none') extra.push(DIET_TO_LABEL[a.diet]);
      if (a.allergies) extra.push('allergie: ' + a.allergies);
      return '- ' + clean(r.values[COL.NAME], 200) + ': ' + (a.attending === 'yes' ? 'ci sarà' : 'non ci sarà') + (extra.length ? ' (' + extra.join(', ') + ')' : '');
    });
    var subject = (isUpdate ? 'RSVP aggiornato' : 'Nuovo RSVP') + ': ' + invite + ' (' + yes + ' sì, ' + no + ' no)';
    var body = lines.join('\n') + (message ? '\n\nMessaggio:\n' + message : '');
    MailApp.sendEmail(to, subject, body);
  } catch (err) {
    // L'avviso è un di più: se fallisce, la risposta dell'invitato resta salvata.
  }
}

/* ───────────── Helper ───────────── */

function readGuests(sheet) {
  var last = sheet.getLastRow();
  if (last < 2) return [];
  var values = sheet.getRange(2, 1, last - 1, GUEST_HEADERS.length).getValues();
  return values.map(function (v, i) { return { row: i + 2, values: v }; });
}

function readConfig(ss) {
  var sheet = ss.getSheetByName(SHEET_CONFIG);
  var cfg = {};
  if (!sheet || sheet.getLastRow() < 2) return cfg;
  sheet.getRange(2, 1, sheet.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) cfg[String(r[0]).trim()] = r[1];
  });
  return cfg;
}

function readMessage(ss, code) {
  var sheet = ss.getSheetByName(SHEET_MESSAGES);
  if (!sheet || sheet.getLastRow() < 2) return '';
  var values = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === code) return String(values[i][2] || '');
  }
  return '';
}

function writeMessage(ss, code, invite, message, now) {
  var sheet = ss.getSheetByName(SHEET_MESSAGES);
  var last = sheet.getLastRow();
  var values = last > 1 ? sheet.getRange(2, 1, last - 1, 1).getValues() : [];
  var row = 0;
  for (var i = 0; i < values.length; i++) {
    if (String(values[i][0]).toUpperCase() === code) { row = i + 2; break; }
  }
  if (!row) {
    if (!message) return;
    row = last + 1;
  }
  var text = sheet.getRange(row, 1, 1, 3);
  text.setNumberFormat('@');
  text.setValues([[code, invite, message]]);
  var stamp = sheet.getRange(row, 4);
  stamp.setNumberFormat('dd/MM/yyyy HH:mm');
  stamp.setValue(now);
}

function isClosed(deadline, tz) {
  if (!deadline) return false;
  var today = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  return today > deadline;
}

function dateString(value, tz) {
  if (value instanceof Date) return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  var s = String(value || '').trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : '';
}

function normalizeCode(raw) {
  var code = String(raw || '').replace(/\s+/g, '').toUpperCase();
  return /^[A-Z0-9]{4,20}$/.test(code) ? code : '';
}

function normalizeSiteUrl(url) {
  var s = String(url || 'https://luciegigi.it/').trim();
  return s.charAt(s.length - 1) === '/' ? s : s + '/';
}

function randomCode() {
  var out = '';
  for (var i = 0; i < CODE_LENGTH; i++) out += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length));
  return out;
}

function isYes(v) {
  return ['sì', 'si', 's', 'x', 'yes', 'y', '1', 'true'].indexOf(String(v).trim().toLowerCase()) !== -1;
}

function pad(n, width) {
  var s = String(n);
  while (s.length < width) s = '0' + s;
  return s;
}

function clean(v, max) {
  return String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}

function cleanMultiline(v, max) {
  return String(v == null ? '' : v).replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, ' ').trim().slice(0, max);
}
