// Crea i file del calendario (assets/matrimonio-it.ics e assets/matrimonio-en.ics) dai dati di js/config.js e js/i18n.js.
// Uso: node tools/make_ics.js
// Da rilanciare ogni volta che cambiano la data, il luogo o i testi "ics.*": il pulsante "Aggiungi al calendario" del sito
// punta a questi file (un indirizzo vero funziona anche su iPhone e nei browser interni di WhatsApp, a differenza di un file generato al volo).
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');

global.window = {};
require(path.join(root, 'js/config.js'));
require(path.join(root, 'js/i18n.js'));
const SITE = window.SITE;
const I18N = window.I18N;

const escapeText = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

// Le righe di un .ics non possono superare 75 byte: si spezzano con un a capo seguito da uno spazio.
function fold(line) {
  const out = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const n = Buffer.byteLength(ch);
    if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const start = SITE.date.replace(/-/g, '');
const next = new Date(Date.UTC(+SITE.date.slice(0, 4), +SITE.date.slice(5, 7) - 1, +SITE.date.slice(8, 10) + 1));
const end = next.toISOString().slice(0, 10).replace(/-/g, '');
const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');

for (const lang of ['it', 'en']) {
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//luciegigi.it//Matrimonio//' + lang.toUpperCase(), 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    'UID:matrimonio-' + start + '@luciegigi.it',   // sempre lo stesso: riaggiungerlo aggiorna l'evento invece di duplicarlo
    'DTSTAMP:' + stamp,
    'DTSTART;VALUE=DATE:' + start,
    'DTEND;VALUE=DATE:' + end,
    'SUMMARY:' + escapeText(I18N[lang]['ics.title']),
    'LOCATION:' + escapeText(SITE.ceremony.mapsQuery),
    'DESCRIPTION:' + escapeText(I18N[lang]['ics.description']),
    'END:VEVENT', 'END:VCALENDAR'
  ].map(fold).join('\r\n') + '\r\n';
  const file = path.join(root, 'assets', `matrimonio-${lang}.ics`);
  fs.writeFileSync(file, lines);
  console.log('scritto', path.relative(root, file));
}
