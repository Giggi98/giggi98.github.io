/**
 * Backend RSVP di luciegigi.it: vive dentro il Google Sheet degli invitati.
 * Istruzioni di installazione in apps-script/README.md.
 *
 * Fogli:
 *   Invitati   una riga per persona (la compilate voi, tranne le colonne grigie)
 *   Messaggi   un messaggio per invito (scritto dal sito)
 *   Config     scadenza, IBAN, email di notifica
 *   Riepilogo  conteggi automatici
 *   Controlli  duplicati ed errori trovati in Invitati (si crea dal menu Matrimonio)
 *
 * Il sito parla con questo script così:
 *   GET  ?action=info                  scadenza, se è chiuso e l'IBAN (pubblici: li vedono tutti gli invitati)
 *   GET  ?action=invite&code=XXXXXX    restituisce una risposta già inviata (per modificarla)
 *   POST {action:'rsvp', code?, lang, people:[...], message}
 *        senza code crea una nuova risposta (e un nuovo codice), con code modifica quella esistente
 */

var SHEET_GUESTS = 'Invitati';
var SHEET_MESSAGES = 'Messaggi';
var SHEET_CONFIG = 'Config';
var SHEET_SUMMARY = 'Riepilogo';
var SHEET_CHECKS = 'Controlli';

var GUEST_HEADERS = ['ID', 'Codice', 'Invito', 'Lingua', 'Nome', 'Bambino', 'Risposta', 'Dieta', 'Allergie', 'Aggiornato', 'Link', 'Seggiolone'];
var COL = { ID: 0, CODE: 1, INVITE: 2, LANG: 3, NAME: 4, CHILD: 5, RESP: 6, DIET: 7, ALLERGY: 8, UPDATED: 9, LINK: 10, HIGHCHAIR: 11 };

var CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // niente I, O, 0, 1: si confondono
var CODE_LENGTH = 6;

var MAX_PEOPLE = 12;  // persone per risposta
var MAX_ROWS = 600;   // righe in Invitati: argine contro chi riempie il foglio a vuoto

var DIET_TO_LABEL = { none: 'Nessuna', vegetarian: 'Vegetariano', vegan: 'Vegano' };
var LABEL_TO_DIET = { nessuna: 'none', vegetariano: 'vegetarian', vegano: 'vegan' };

var CONFIG_DEFAULTS = [
  ['scadenza_rsvp', '2027-04-30', 'Ultimo giorno per rispondere o modificare (AAAA-MM-GG)'],
  ['email_notifica', '', 'Email che riceve un avviso a ogni risposta (vuoto = nessuna)'],
  ['notifica_attiva', 'SI', 'SI o NO'],
  ['sito_url', 'https://luciegigi.it/', 'Indirizzo del sito, usato per i link personali'],
  ['intestatario', '', 'Intestatario del conto per il regalo di nozze'],
  ['iban', '', 'IBAN: compare nella sezione "Regalo di nozze" del sito (lo vede chi apre il sito)'],
  ['causale', '', 'Causale suggerita per il bonifico (facoltativa)']
];

/* ───────────── Menu nel foglio ───────────── */

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Matrimonio')
    .addItem('1. Prepara i fogli', 'setup')
    .addItem('2. Genera codici e link', 'generateCodes')
    .addItem('3. Controlla duplicati ed errori', 'checkGuests')
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
  // Fogli creati prima della colonna "Seggiolone": aggiunge l'intestazione.
  if (!guests.getRange(1, COL.HIGHCHAIR + 1).getValue()) {
    guests.getRange(1, COL.HIGHCHAIR + 1).setValue('Seggiolone').setFontWeight('bold').setBackground('#d9e8f0');
  }
  // Allergie e messaggi sono testo libero: formato "testo" così nessun valore viene letto come formula.
  guests.getRange(2, COL.ALLERGY + 1, 1000, 1).setNumberFormat('@');
  guests.getRange(2, COL.LANG + 1, 1000, 1).setDataValidation(
    SpreadsheetApp.newDataValidation().requireValueInList(['it', 'en'], true).build());

  // Nomi doppi (anche con maiuscole diverse) in rosso, mentre si scrive o si riceve una risposta.
  var dupRule = SpreadsheetApp.newConditionalFormatRule()
    .whenFormulaSatisfied('=AND($E2<>"",COUNTIF($E$2:$E,$E2)>1)')
    .setBackground('#f4c7c3')
    .setRanges([guests.getRange(2, COL.NAME + 1, 1000, 1)])
    .build();
  guests.setConditionalFormatRules([dupRule]);

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
  summary.getRange(1, 1, 11, 2).setFormulas([
    ['Persone invitate', '=COUNTA(' + G + 'E2:E)'],
    ['Confermate', '=COUNTIF(' + G + 'G2:G,"Sì")'],
    ['Non vengono', '=COUNTIF(' + G + 'G2:G,"No")'],
    ['Senza risposta', '=B1-B2-B3'],
    ['Menù bimbi (confermati)', '=COUNTIFS(' + G + 'F2:F,"Sì",' + G + 'G2:G,"Sì")'],
    ['Vegetariani (confermati)', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'H2:H,"Vegetariano")'],
    ['Vegani (confermati)', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'H2:H,"Vegano")'],
    ['Con allergie o intolleranze', '=COUNTIFS(' + G + 'G2:G,"Sì",' + G + 'I2:I,"<>")'],
    ['Bimbi con seggiolone proprio', '=COUNTIFS(' + G + 'F2:F,"Sì",' + G + 'G2:G,"Sì",' + G + 'L2:L,"Sì")'],
    ['Bimbi senza seggiolone (da fornire)', '=COUNTIFS(' + G + 'F2:F,"Sì",' + G + 'G2:G,"Sì",' + G + 'L2:L,"No")'],
    ['Righe con nome doppio (controlla)', '=SUMPRODUCT((' + G + 'E2:E<>"")*(COUNTIF(' + G + 'E2:E,' + G + 'E2:E)>1))']
  ]);
  summary.getRange(1, 1, 11, 1).setFontWeight('bold');
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

/* ───────────── Controlli su duplicati ed errori ───────────── */

/**
 * Scrive nel foglio "Controlli" i problemi trovati in "Invitati": nomi doppi o quasi doppi,
 * righe senza nome, codici condivisi da inviti diversi, bambini senza un adulto che viene.
 */
function checkGuests() {
  var ss = SpreadsheetApp.getActive();
  var rows = readGuests(ss.getSheetByName(SHEET_GUESTS)).filter(function (r) {
    return clean(r.values[COL.NAME], 200) || clean(r.values[COL.INVITE], 200);
  });
  var issues = findIssues(rows, ss.getSpreadsheetTimeZone());

  var sheet = ss.getSheetByName(SHEET_CHECKS) || ss.insertSheet(SHEET_CHECKS);
  sheet.clear();
  var table = [['Problema', 'Dettaglio', 'Righe in Invitati']];
  if (issues.length) issues.forEach(function (i) { table.push([i.type, i.detail, i.rows.join(', ')]); });
  else table.push(['Tutto a posto', 'Nessun problema trovato', '']);
  sheet.getRange(1, 1, table.length, 3).setValues(table);
  sheet.getRange(1, 1, 1, 3).setFontWeight('bold').setBackground('#d9e8f0');
  sheet.setFrozenRows(1);
  sheet.setColumnWidth(1, 220);
  sheet.setColumnWidth(2, 460);
  sheet.setColumnWidth(3, 160);

  SpreadsheetApp.getUi().alert(issues.length
    ? 'Trovati ' + issues.length + ' problemi: guarda il foglio "Controlli".'
    : 'Nessun problema trovato.');
  return issues;
}

function findIssues(rows, tz) {
  var issues = [];
  var byName = {}, byTokens = {}, byCode = {}, byInvite = {};
  var named = [];

  rows.forEach(function (r) {
    var name = clean(r.values[COL.NAME], 200);
    var code = clean(r.values[COL.CODE], 20).toUpperCase();
    var invite = clean(r.values[COL.INVITE], 200);
    var resp = String(r.values[COL.RESP]).trim();

    if (!name) {
      issues.push({ type: 'Nome mancante', detail: invite ? 'Invito "' + invite + '" ha una riga senza nome' : 'Riga senza nome né invito', rows: [r.row] });
      return;
    }
    var key = normalizeName(name);
    (byName[key] = byName[key] || []).push(r);
    var tokens = key.split(' ').sort().join(' ');
    (byTokens[tokens] = byTokens[tokens] || []).push(r);
    named.push({ key: key, row: r.row, name: name, code: code });

    if (code) (byCode[code] = byCode[code] || {})[invite] = true;
    if (code) (byInvite[code] = byInvite[code] || []).push({ child: isYes(r.values[COL.CHILD]), yes: resp.toLowerCase() === 'sì' || resp.toLowerCase() === 'si' });
  });

  Object.keys(byName).forEach(function (key) {
    var list = byName[key];
    if (list.length < 2) return;
    var same = list.every(function (r) { return String(r.values[COL.CODE]).toUpperCase() === String(list[0].values[COL.CODE]).toUpperCase(); });
    var latest = latestAnswer(list);
    issues.push({
      type: same ? 'Nome ripetuto nello stesso invito' : 'Nome doppio (inviti diversi)',
      detail: clean(list[0].values[COL.NAME], 200) + ': ' + list.map(function (r) { return describeRow(r, tz); }).join(' | ')
        + (latest && !same ? ' → probabile doppia risposta, la più recente è la riga ' + latest.row : ''),
      rows: list.map(function (r) { return r.row; })
    });
  });

  // Stesse parole in ordine diverso ("Bianchi Mario" / "Mario Bianchi"): non ancora segnalate come nome doppio.
  Object.keys(byTokens).forEach(function (tokens) {
    var keys = {};
    byTokens[tokens].forEach(function (r) { keys[normalizeName(clean(r.values[COL.NAME], 200))] = true; });
    if (Object.keys(keys).length < 2) return;
    issues.push({
      type: 'Stesso nome in ordine diverso',
      detail: byTokens[tokens].map(function (r) { return clean(r.values[COL.NAME], 200); }).filter(function (n, i, a) { return a.indexOf(n) === i; }).join(' / '),
      rows: byTokens[tokens].map(function (r) { return r.row; })
    });
  });

  // Nomi quasi uguali (un refuso): solo tra righe di inviti diversi e nomi non troppo corti.
  for (var i = 0; i < named.length; i++) {
    for (var j = i + 1; j < named.length; j++) {
      var a = named[i], b = named[j];
      if (a.key === b.key || a.code === b.code || a.key.length < 8 || b.key.length < 8) continue;
      if (Math.abs(a.key.length - b.key.length) > 1) continue;
      if (editDistance(a.key, b.key) <= 1) {
        issues.push({ type: 'Nome quasi uguale (refuso?)', detail: a.name + ' / ' + b.name, rows: [a.row, b.row] });
      }
    }
  }

  Object.keys(byCode).forEach(function (code) {
    var invites = Object.keys(byCode[code]);
    if (invites.length > 1) {
      issues.push({ type: 'Codice condiviso da inviti diversi', detail: code + ': ' + invites.join(' / '), rows: [] });
    }
  });

  Object.keys(byInvite).forEach(function (code) {
    var people = byInvite[code];
    var childComing = people.some(function (p) { return p.child && p.yes; });
    var adultComing = people.some(function (p) { return !p.child && p.yes; });
    if (childComing && !adultComing) {
      var first = rows.filter(function (r) { return String(r.values[COL.CODE]).toUpperCase() === code; });
      issues.push({
        type: 'Bambino senza adulti che vengono',
        detail: 'Invito "' + clean(first[0].values[COL.INVITE], 200) + '" (' + code + ')',
        rows: first.map(function (r) { return r.row; })
      });
    }
  });

  return issues;
}

// Riga con la risposta più recente (quella che l'invitato considera valida), se hanno una data.
function latestAnswer(list) {
  var best = null;
  list.forEach(function (r) {
    var d = r.values[COL.UPDATED];
    if (!(d instanceof Date)) return;
    if (!best || d.getTime() >= best.values[COL.UPDATED].getTime()) best = r;
  });
  return best;
}

function describeRow(r, tz) {
  var d = r.values[COL.UPDATED];
  var parts = ['invito "' + clean(r.values[COL.INVITE], 100) + '"'];
  if (d instanceof Date) parts.push(Utilities.formatDate(d, tz, 'dd/MM/yyyy HH:mm'));
  var resp = String(r.values[COL.RESP]).trim();
  if (resp) parts.push(resp);
  return 'riga ' + r.row + ' (' + parts.join(', ') + ')';
}

function normalizeName(name) {
  return String(name).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a, b) {
  var prev = [], cur = [];
  for (var j = 0; j <= b.length; j++) prev[j] = j;
  for (var i = 1; i <= a.length; i++) {
    cur = [i];
    for (var k = 1; k <= b.length; k++) {
      cur[k] = Math.min(prev[k] + 1, cur[k - 1] + 1, prev[k - 1] + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

/* ───────────── Web app ───────────── */

function doGet(e) {
  var p = (e && e.parameter) || {};
  if (p.action === 'invite') return json(getInvite(p.code));
  if (p.action === 'info') return json(getInfo());
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
      highchair: highchairOf(v[COL.HIGHCHAIR]),
      attending: resp === 'sì' || resp === 'si' ? 'yes' : (resp === 'no' ? 'no' : null),
      diet: LABEL_TO_DIET[String(v[COL.DIET]).trim().toLowerCase()] || 'none',
      allergies: clean(v[COL.ALLERGY], 300)
    };
  });

  var deadline = dateString(cfg.scadenza_rsvp, tz);
  var gift = giftFrom(cfg);

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

function getInfo() {
  var ss = SpreadsheetApp.getActive();
  var cfg = readConfig(ss);
  var tz = ss.getSpreadsheetTimeZone();
  var deadline = dateString(cfg.scadenza_rsvp, tz);
  return { ok: true, info: { deadline: deadline, closed: isClosed(deadline, tz), gift: giftFrom(cfg) } };
}

function giftFrom(cfg) {
  return cfg.iban ? { iban: String(cfg.iban), holder: String(cfg.intestatario || ''), reason: String(cfg.causale || '') } : null;
}

/**
 * Salva una risposta. Senza `code` crea un nuovo invito (codice nuovo, una riga per persona);
 * con `code` aggiorna quello esistente: tutte le sue persone devono essere nell'elenco (con il loro id),
 * le persone senza id vengono aggiunte.
 */
function saveRsvp(body) {
  var rawCode = String(body.code || '').trim();
  var code = rawCode ? normalizeCode(rawCode) : '';
  if (rawCode && !code) return { ok: false, error: 'invalid_code' };

  // Campo trappola: i visitatori non lo vedono, i bot lo compilano. Rispondiamo "ok" senza scrivere nulla.
  if (body.website) return { ok: true, code: '', answeredAt: new Date().toISOString() };

  var list = Array.isArray(body.people) ? body.people : [];
  if (!list.length || list.length > MAX_PEOPLE) return { ok: false, error: 'invalid_data' };

  var lock = LockService.getScriptLock();
  try { lock.waitLock(15000); } catch (err) { return { ok: false, error: 'busy' }; }

  try {
    var ss = SpreadsheetApp.getActive();
    var sheet = ss.getSheetByName(SHEET_GUESTS);
    var all = readGuests(sheet);
    var rows = code ? all.filter(function (r) { return String(r.values[COL.CODE]).toUpperCase() === code; }) : [];
    if (code && !rows.length) return { ok: false, error: 'invalid_code' };

    var cfg = readConfig(ss);
    var tz = ss.getSpreadsheetTimeZone();
    if (isClosed(dateString(cfg.scadenza_rsvp, tz), tz)) return { ok: false, error: 'closed' };

    var byId = {};
    rows.forEach(function (r) { byId[String(r.values[COL.ID])] = r; });
    var seen = {};
    var entries = [];
    for (var i = 0; i < list.length; i++) {
      var a = list[i] || {};
      var attending = a.attending;
      var diet = a.diet || 'none';
      if ((attending !== 'yes' && attending !== 'no') || !DIET_TO_LABEL[diet]) return { ok: false, error: 'invalid_data' };
      var id = a.id ? String(a.id) : '';
      var known = id ? byId[id] : null;
      if (id && (!known || seen[id])) return { ok: false, error: 'invalid_data' };
      var name = clean(a.name, 100).replace(/\s+/g, ' ') || (known ? clean(known.values[COL.NAME], 200) : '');
      if (!name) return { ok: false, error: 'invalid_data' };
      if (id) seen[id] = true;
      entries.push({
        id: id,
        row: known ? known.row : 0,
        name: name,
        child: typeof a.child === 'boolean' ? a.child : (known ? isYes(known.values[COL.CHILD]) : false),
        highchair: null,
        attending: attending,
        diet: attending === 'yes' ? diet : 'none',
        allergies: attending === 'yes' ? clean(a.allergies, 300) : ''
      });
    }
    // Il seggiolone si chiede solo per i bambini che vengono: "yes" = lo portano, "no" = serve quello del locale.
    entries.forEach(function (e, n) {
      var h = list[n] && list[n].highchair;
      e.highchair = e.child && e.attending === 'yes' && (h === 'yes' || h === 'no') ? h : null;
    });
    if (Object.keys(byId).some(function (knownId) { return !seen[knownId]; })) return { ok: false, error: 'invalid_data' };
    if (!code && sheet.getLastRow() >= MAX_ROWS) return { ok: false, error: 'full' };

    var used = {};
    var maxId = 0;
    all.forEach(function (r) {
      var c = clean(r.values[COL.CODE], 20).toUpperCase();
      if (c) used[c] = true;
      var m = /^P(\d+)$/.exec(String(r.values[COL.ID]));
      if (m) maxId = Math.max(maxId, parseInt(m[1], 10));
    });

    var now = new Date();
    var before = rows.some(function (r) { return r.values[COL.UPDATED] instanceof Date; });
    var invite, link = '';
    if (code) {
      invite = clean(rows[0].values[COL.INVITE], 200);
    } else {
      do { code = randomCode(); } while (used[code]);
      invite = clean(entries[0].name, 200);
      link = normalizeSiteUrl(cfg.sito_url) + '?invito=' + code;
    }
    var lang = body.lang === 'en' ? 'en' : (rows.length ? String(rows[0].values[COL.LANG]).trim().toLowerCase() : 'it');
    var next = sheet.getLastRow() + 1;

    entries.forEach(function (e) {
      var label = e.attending === 'yes' ? 'Sì' : 'No';
      if (e.row) {
        // Persona già nel foglio: nome e bambino come li ha scritti l'invitato, poi risposta, dieta e allergie.
        var who = sheet.getRange(e.row, COL.NAME + 1, 1, 2);
        who.setNumberFormat('@');
        who.setValues([[e.name, e.child ? 'Sì' : '']]);
        var text = sheet.getRange(e.row, COL.RESP + 1, 1, 3);
        text.setNumberFormat('@');
        text.setValues([[label, DIET_TO_LABEL[e.diet], e.allergies]]);
        var stamp = sheet.getRange(e.row, COL.UPDATED + 1);
        stamp.setNumberFormat('dd/MM/yyyy HH:mm');
        stamp.setValue(now);
        writeHighchair(sheet, e);
        return;
      }
      // Persona nuova: una riga in fondo. Tutto come testo (nessun valore letto come formula o come numero).
      e.row = next++;
      var line = sheet.getRange(e.row, 1, 1, COL.ALLERGY + 1);
      line.setNumberFormat('@');
      line.setValues([['P' + pad(++maxId, 4), code, invite, lang, e.name, e.child ? 'Sì' : '', label, DIET_TO_LABEL[e.diet], e.allergies]]);
      var created = sheet.getRange(e.row, COL.UPDATED + 1);
      created.setNumberFormat('dd/MM/yyyy HH:mm');
      created.setValue(now);
      if (link) sheet.getRange(e.row, COL.LINK + 1).setValue(link);
      writeHighchair(sheet, e);
    });

    var message = cleanMultiline(body.message, 1000);
    writeMessage(ss, code, invite, message, now);

    notify(cfg, invite, entries, message, before);
    return { ok: true, code: code, answeredAt: now.toISOString(), invite: getInvite(code).invite };
  } finally {
    lock.releaseLock();
  }
}

function notify(cfg, invite, entries, message, isUpdate) {
  try {
    var to = String(cfg.email_notifica || '').trim();
    if (!to || String(cfg.notifica_attiva || 'SI').trim().toUpperCase() !== 'SI') return;
    var yes = 0, no = 0;
    var lines = entries.map(function (e) {
      if (e.attending === 'yes') yes++; else no++;
      var extra = [];
      if (e.child) extra.push('bambino');
      if (e.highchair === 'yes') extra.push('porta il seggiolone');
      if (e.highchair === 'no') extra.push('serve un seggiolone');
      if (e.diet !== 'none') extra.push(DIET_TO_LABEL[e.diet]);
      if (e.allergies) extra.push('allergie: ' + e.allergies);
      return '- ' + e.name + ': ' + (e.attending === 'yes' ? 'ci sarà' : 'non ci sarà') + (extra.length ? ' (' + extra.join(', ') + ')' : '');
    });
    var subject = (isUpdate ? 'RSVP aggiornato' : 'Nuovo RSVP') + ': ' + invite + ' (' + yes + ' sì, ' + no + ' no)';
    var body = lines.join('\n') + (message ? '\n\nMessaggio:\n' + message : '');
    MailApp.sendEmail(to, subject, body);
  } catch (err) {
    // L'avviso è un di più: se fallisce, la risposta dell'invitato resta salvata.
  }
}

/* ───────────── Helper ───────────── */

function highchairOf(v) {
  var s = String(v).trim().toLowerCase();
  return s === 'sì' || s === 'si' ? 'yes' : (s === 'no' ? 'no' : null);
}

function writeHighchair(sheet, e) {
  var cell = sheet.getRange(e.row, COL.HIGHCHAIR + 1);
  cell.setNumberFormat('@');
  cell.setValue(e.highchair === 'yes' ? 'Sì' : (e.highchair === 'no' ? 'No' : ''));
}

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
