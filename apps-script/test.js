// Collaudo locale di Code.gs con un finto Google Sheet. Uso: node apps-script/test.js
const assert = require('assert');
const { makeEnv } = require('./mock');

const get = (env, params) => JSON.parse(env.sandbox.doGet({ parameter: params }).content);
const post = (env, body) => JSON.parse(env.sandbox.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).content);
function setConfig(env, key, value) {
  const sh = env.sheets.Config;
  for (let i = 2; i <= sh.getLastRow(); i++) if (sh.data[i - 1][0] === key) return sh.put(i, 2, value);
  throw new Error('config key not found: ' + key);
}

const tests = [];
const test = (name, fn) => tests.push([name, fn]);

function seeded() {
  const env = makeEnv();
  env.sandbox.setup();
  const g = env.sheets.Invitati;
  g.data.splice(1); // via le righe di esempio
  [
    ['', '', 'Famiglia Rossi', 'it', 'Mario Rossi', ''],
    ['', '', 'Famiglia Rossi', 'it', 'Giulia Rossi', ''],
    ['', '', 'Famiglia Rossi', 'it', 'Luca Rossi', 'Sì'],
    ['', '', 'Anna Smith', 'en', 'Anna Smith', '']
  ].forEach((row, i) => g.getRange(2 + i, 1, 1, 6).setValues([row]));
  env.sandbox.generateCodes();
  setConfig(env, 'email_notifica', 'sposi@example.com');
  return env;
}

test('setup crea i quattro fogli e il riepilogo', () => {
  const env = makeEnv();
  env.sandbox.setup();
  ['Invitati', 'Messaggi', 'Config', 'Riepilogo'].forEach((n) => assert.ok(env.sheets[n], n));
  assert.ok(String(env.sheets.Riepilogo.data[1][1]).startsWith('=COUNTIF('));
});

test('generateCodes: stesso codice per invito, ID unici, link', () => {
  const env = seeded();
  const rows = env.sheets.Invitati.data.slice(1);
  const rossi = rows.slice(0, 3).map((r) => r[1]);
  assert.ok(/^[A-HJ-NP-Z2-9]{6}$/.test(rossi[0]), rossi[0]);
  assert.strictEqual(new Set(rossi).size, 1);
  assert.notStrictEqual(rows[3][1], rossi[0]);
  assert.deepStrictEqual(rows.map((r) => r[0]), ['P0001', 'P0002', 'P0003', 'P0004']);
  assert.strictEqual(rows[0][10], 'https://luciegigi.it/?invito=' + rossi[0]);

  const before = rows.map((r) => r[1]);
  env.sandbox.generateCodes(); // seconda esecuzione: non cambia nulla
  assert.deepStrictEqual(env.sheets.Invitati.data.slice(1).map((r) => r[1]), before);
});

test('GET invito: persone, bambino, lingua, niente IBAN se non configurato', () => {
  const env = seeded();
  const code = env.sheets.Invitati.data[1][1];
  const res = get(env, { action: 'invite', code: ' ' + code.toLowerCase() + ' ' });
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.invite.greeting, 'Famiglia Rossi');
  assert.strictEqual(res.invite.lang, 'it');
  assert.deepStrictEqual(res.invite.people.map((p) => [p.name, p.child, p.attending]), [
    ['Mario Rossi', false, null], ['Giulia Rossi', false, null], ['Luca Rossi', true, null]]);
  assert.strictEqual(res.invite.gift, null);
  assert.strictEqual(res.invite.deadline, '2027-04-30');
  assert.strictEqual(res.invite.closed, false);
  const en = get(env, { action: 'invite', code: env.sheets.Invitati.data[4][1] });
  assert.strictEqual(en.invite.lang, 'en');
});

test('GET codice sbagliato o vuoto: invalid_code, senza dettagli', () => {
  const env = seeded();
  assert.deepStrictEqual(get(env, { action: 'invite', code: 'ZZZZZZ' }), { ok: false, error: 'invalid_code' });
  assert.deepStrictEqual(get(env, { action: 'invite', code: '' }), { ok: false, error: 'invalid_code' });
  assert.deepStrictEqual(get(env, { action: 'invite', code: "';DROP" }), { ok: false, error: 'invalid_code' });
  assert.deepStrictEqual(get(env, { action: 'invite' }), { ok: false, error: 'invalid_code' });
});

test('IBAN: dentro un invito valido sì, con codice sbagliato o senza azione no', () => {
  const env = seeded();
  setConfig(env, 'iban', 'IT60X0542811101000000123456');
  setConfig(env, 'intestatario', 'Lucia e Luigi');
  const res = get(env, { action: 'invite', code: env.sheets.Invitati.data[1][1] });
  assert.strictEqual(res.invite.gift.iban, 'IT60X0542811101000000123456');
  assert.ok(!JSON.stringify(get(env, { action: 'invite', code: 'NOPE99' })).includes('IT60'));
  assert.ok(!JSON.stringify(get(env, {})).includes('IT60'));
});

function answers(env, code, over) {
  const people = get(env, { action: 'invite', code }).invite.people;
  return {
    action: 'rsvp', code, message: 'Auguri!',
    people: people.map((p, i) => Object.assign({ id: p.id, attending: 'yes', diet: 'none', allergies: '' }, over && over[i]))
  };
}

test('POST salva risposte, dieta, allergie, messaggio e avvisa', () => {
  const env = seeded();
  const code = env.sheets.Invitati.data[1][1];
  const res = post(env, answers(env, code, [
    { diet: 'vegetarian', allergies: ' arachidi ' }, { attending: 'no', diet: 'vegan', allergies: 'x' }, {}]));
  assert.strictEqual(res.ok, true);
  const rows = env.sheets.Invitati.data.slice(1, 4);
  assert.deepStrictEqual(rows.map((r) => r.slice(6, 9)), [
    ['Sì', 'Vegetariano', 'arachidi'], ['No', 'Nessuna', ''], ['Sì', 'Nessuna', '']]);
  assert.ok(rows.every((r) => Object.prototype.toString.call(r[9]) === '[object Date]')); // il finto foglio vive in un altro realm: niente instanceof
  assert.strictEqual(env.sheets.Messaggi.data[1][2], 'Auguri!');
  assert.strictEqual(env.mails.length, 1);
  assert.strictEqual(env.mails[0].to, 'sposi@example.com');
  assert.ok(env.mails[0].subject.includes('Nuovo RSVP') && env.mails[0].subject.includes('2 sì, 1 no'), env.mails[0].subject);

  const back = get(env, { action: 'invite', code }).invite;
  assert.deepStrictEqual(back.people.map((p) => [p.attending, p.diet, p.allergies]), [
    ['yes', 'vegetarian', 'arachidi'], ['no', 'none', ''], ['yes', 'none', '']]);
  assert.strictEqual(back.message, 'Auguri!');
  assert.ok(back.answeredAt);

  // modifica: stessa riga messaggio, mail "aggiornato"
  post(env, Object.assign(answers(env, code), { message: 'Cambio idea' }));
  assert.strictEqual(env.sheets.Messaggi.getLastRow(), 2);
  assert.strictEqual(env.sheets.Messaggi.data[1][2], 'Cambio idea');
  assert.ok(env.mails[1].subject.startsWith('RSVP aggiornato'));
});

test('POST senza messaggio non crea righe vuote in Messaggi', () => {
  const env = seeded();
  const code = env.sheets.Invitati.data[4][1];
  assert.strictEqual(post(env, Object.assign(answers(env, code), { message: '' })).ok, true);
  assert.strictEqual(env.sheets.Messaggi.getLastRow(), 1);
});

test('POST rifiuta dati incompleti o di un altro invito', () => {
  const env = seeded();
  const code = env.sheets.Invitati.data[1][1];
  const full = answers(env, code);
  const otherId = env.sheets.Invitati.data[4][0];

  assert.strictEqual(post(env, Object.assign({}, full, { people: full.people.slice(1) })).error, 'invalid_data');
  assert.strictEqual(post(env, Object.assign({}, full, { people: full.people.map((p, i) => i ? p : Object.assign({}, p, { id: otherId })) })).error, 'invalid_data');
  assert.strictEqual(post(env, Object.assign({}, full, { people: full.people.map((p) => Object.assign({}, p, { attending: 'forse' })) })).error, 'invalid_data');
  assert.strictEqual(post(env, Object.assign({}, full, { people: full.people.map((p) => Object.assign({}, p, { diet: 'carnivoro' })) })).error, 'invalid_data');
  assert.strictEqual(post(env, Object.assign({}, full, { code: 'ZZZZZZ' })).error, 'invalid_code');
  assert.strictEqual(post(env, 'non json').error, 'invalid_data');
  assert.strictEqual(post(env, { action: 'altro' }).error, 'invalid_data');
  assert.ok(!env.sheets.Invitati.data[1][6]); // nulla è stato scritto
  assert.strictEqual(env.mails.length, 0);
});

test('dopo la scadenza GET dice closed e POST rifiuta', () => {
  const env = seeded();
  setConfig(env, 'scadenza_rsvp', '2020-01-01');
  const code = env.sheets.Invitati.data[1][1];
  assert.strictEqual(get(env, { action: 'invite', code }).invite.closed, true);
  assert.strictEqual(post(env, answers(env, code)).error, 'closed');
  assert.ok(!env.sheets.Invitati.data[1][6]);
});

test('testi lunghi e caratteri di controllo vengono ripuliti', () => {
  const env = seeded();
  const code = env.sheets.Invitati.data[4][1];
  const body = answers(env, code, [{ allergies: 'a\u0000b\n' + 'x'.repeat(500) }]);
  body.message = 'riga1\r\nriga2\u0007' + 'y'.repeat(2000);
  assert.strictEqual(post(env, body).ok, true);
  const row = env.sheets.Invitati.data[4];
  assert.ok(row[8].length <= 300 && !/[\u0000-\u001f]/.test(row[8]));
  assert.ok(env.sheets.Messaggi.data[1][2].length <= 1000 && env.sheets.Messaggi.data[1][2].startsWith('riga1\nriga2 '));
});

test('senza email di notifica non parte nessuna mail', () => {
  const env = seeded();
  setConfig(env, 'email_notifica', '');
  post(env, answers(env, env.sheets.Invitati.data[4][1]));
  assert.strictEqual(env.mails.length, 0);
});

function newRsvp(over) {
  return Object.assign({
    action: 'rsvp', lang: 'it', message: 'Evviva',
    people: [
      { name: ' Mario  Bianchi ', child: false, attending: 'yes', diet: 'vegetarian', allergies: 'noci' },
      { name: 'Sofia Bianchi', child: true, attending: 'yes', diet: 'none', allergies: '' },
      { name: 'Zio Gino', child: false, attending: 'no', diet: 'vegan', allergies: 'x' }
    ]
  }, over);
}

test('POST senza codice crea un nuovo invito: codice, righe, link, messaggio, mail', () => {
  const env = seeded();
  const res = post(env, newRsvp());
  assert.strictEqual(res.ok, true);
  assert.ok(/^[A-HJ-NP-Z2-9]{6}$/.test(res.code), res.code);
  const rows = env.sheets.Invitati.data.slice(5); // dopo le 4 righe di prova
  assert.strictEqual(rows.length, 3);
  assert.deepStrictEqual(rows.map((r) => r[0]), ['P0005', 'P0006', 'P0007']);
  assert.ok(rows.every((r) => r[1] === res.code && r[2] === 'Mario Bianchi' && r[3] === 'it'));
  assert.deepStrictEqual(rows.map((r) => r.slice(4, 9)), [
    ['Mario Bianchi', '', 'Sì', 'Vegetariano', 'noci'],
    ['Sofia Bianchi', 'Sì', 'Sì', 'Nessuna', ''],
    ['Zio Gino', '', 'No', 'Nessuna', '']]);
  assert.strictEqual(rows[0][10], 'https://luciegigi.it/?invito=' + res.code);
  assert.ok(rows.every((r) => Object.prototype.toString.call(r[9]) === '[object Date]'));
  assert.strictEqual(env.sheets.Messaggi.data[1][0], res.code);
  assert.strictEqual(env.sheets.Messaggi.data[1][2], 'Evviva');
  assert.ok(env.mails[0].subject.includes('Nuovo RSVP: Mario Bianchi (2 sì, 1 no)'), env.mails[0].subject);
  assert.ok(env.mails[0].body.includes('Sofia Bianchi: ci sarà (bambino)'));
  // la risposta contiene già l'invito completo, con gli id da usare per modificare
  assert.deepStrictEqual(res.invite.people.map((p) => p.id), ['P0005', 'P0006', 'P0007']);
  assert.strictEqual(res.invite.people[1].child, true);
  assert.deepStrictEqual(get(env, { action: 'invite', code: res.code }).invite.people.map((p) => p.attending), ['yes', 'yes', 'no']);
});

test('POST con codice modifica: nomi, nuova persona, nessun duplicato di righe', () => {
  const env = seeded();
  const first = post(env, newRsvp());
  const people = first.invite.people.map((p) => ({ id: p.id, name: p.name, child: p.child, attending: p.attending, diet: p.diet, allergies: p.allergies }));
  people[2] = Object.assign({}, people[2], { name: 'Gino Bianchi', attending: 'yes' });
  people.push({ name: 'Nonna Rosa', child: false, attending: 'yes', diet: 'none', allergies: '' });
  const res = post(env, newRsvp({ code: first.code, people, message: 'Cambiato' }));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.code, first.code);
  const rows = env.sheets.Invitati.data.slice(5);
  assert.deepStrictEqual(rows.map((r) => [r[0], r[4], r[6]]), [
    ['P0005', 'Mario Bianchi', 'Sì'], ['P0006', 'Sofia Bianchi', 'Sì'], ['P0007', 'Gino Bianchi', 'Sì'], ['P0008', 'Nonna Rosa', 'Sì']]);
  assert.ok(rows.every((r) => r[1] === first.code && r[2] === 'Mario Bianchi'));
  assert.strictEqual(env.sheets.Messaggi.getLastRow(), 2);
  assert.strictEqual(env.sheets.Messaggi.data[1][2], 'Cambiato');
  assert.ok(env.mails[1].subject.startsWith('RSVP aggiornato'));
  // togliere una persona già salvata non è permesso: si segna "non viene"
  const partial = post(env, newRsvp({ code: first.code, people: people.slice(1).filter((p) => p.id) }));
  assert.strictEqual(partial.error, 'invalid_data');
});

test('nuovo invito: dati non validi, troppi nomi, foglio pieno, scadenza', () => {
  const env = seeded();
  const rows = () => env.sheets.Invitati.getLastRow();
  const before = rows();
  const ok = newRsvp().people;
  assert.strictEqual(post(env, newRsvp({ people: [] })).error, 'invalid_data');
  assert.strictEqual(post(env, newRsvp({ people: [{ name: '  ', attending: 'yes' }] })).error, 'invalid_data');
  assert.strictEqual(post(env, newRsvp({ people: [{ name: 'A', attending: 'forse' }] })).error, 'invalid_data');
  assert.strictEqual(post(env, newRsvp({ people: [{ id: 'P0001', name: 'A', attending: 'yes' }] })).error, 'invalid_data'); // id di un altro invito, senza codice
  assert.strictEqual(post(env, newRsvp({ people: Array.from({ length: 13 }, (_, i) => ({ name: 'P' + i, attending: 'no' })) })).error, 'invalid_data');
  assert.strictEqual(post(env, newRsvp({ code: 'ZZZZZZ' })).error, 'invalid_code');
  assert.strictEqual(rows(), before);
  setConfig(env, 'scadenza_rsvp', '2020-01-01');
  assert.strictEqual(post(env, newRsvp({ people: ok })).error, 'closed');
  setConfig(env, 'scadenza_rsvp', '2027-04-30');
  for (let i = before + 1; i <= 600; i++) env.sheets.Invitati.put(i, 5, 'riga ' + i);
  assert.strictEqual(post(env, newRsvp()).error, 'full');
});

test('campo trappola compilato: finto successo e nessuna scrittura', () => {
  const env = seeded();
  const before = env.sheets.Invitati.getLastRow();
  const res = post(env, newRsvp({ website: 'http://spam.example' }));
  assert.strictEqual(res.ok, true);
  assert.strictEqual(res.code, '');
  assert.strictEqual(env.sheets.Invitati.getLastRow(), before);
  assert.strictEqual(env.mails.length, 0);
});

test('lingua dell\'invito: en dal sito', () => {
  const env = seeded();
  const res = post(env, newRsvp({ lang: 'en', people: [{ name: 'John Smith', attending: 'yes' }] }));
  assert.strictEqual(res.invite.lang, 'en');
  assert.strictEqual(get(env, { action: 'invite', code: res.code }).invite.lang, 'en');
});

test('GET info: scadenza, chiusura e IBAN per tutti, senza dati degli invitati', () => {
  const env = seeded();
  assert.deepStrictEqual(get(env, { action: 'info' }).info, { deadline: '2027-04-30', closed: false, gift: null });
  setConfig(env, 'iban', 'IT60X0542811101000000123456');
  setConfig(env, 'intestatario', 'Luigi Cagliani');
  const info = get(env, { action: 'info' }).info;
  assert.strictEqual(info.gift.iban, 'IT60X0542811101000000123456');
  assert.strictEqual(info.gift.holder, 'Luigi Cagliani');
  assert.ok(!JSON.stringify(info).includes('Rossi'));
  setConfig(env, 'scadenza_rsvp', '2020-01-01');
  assert.strictEqual(get(env, { action: 'info' }).info.closed, true);
});

test('checkGuests: nessun problema sul foglio pulito', () => {
  const env = seeded();
  env.sandbox.checkGuests();
  assert.deepStrictEqual(env.sheets.Controlli.data[1].slice(0, 2), ['Tutto a posto', 'Nessun problema trovato']);
  assert.ok(env.alerts[env.alerts.length - 1].startsWith('Nessun problema'));
});

test('checkGuests: nomi doppi, ordine diverso, refusi, bambini soli, righe senza nome', () => {
  const env = seeded();
  const one = (name, extra) => post(env, newRsvp({ people: [Object.assign({ name, attending: 'yes' }, extra)] }));
  one('Mario Bianchi');
  one('mario  bianchi');                         // doppio (maiuscole e spazi)
  one('Bianchi Mario');                          // ordine diverso
  one('Giovanni Esposito');
  one('Giovanni Espozito');                      // refuso
  one('Piccolo Pietro', { child: true });        // bambino da solo
  env.sheets.Invitati.put(env.sheets.Invitati.getLastRow() + 1, 3, 'Famiglia Vuota'); // riga senza nome
  const issues = env.sandbox.checkGuests();
  const types = issues.map((i) => i.type);
  assert.ok(types.includes('Nome doppio (inviti diversi)'), types.join('|'));
  assert.ok(types.includes('Stesso nome in ordine diverso'), types.join('|'));
  assert.ok(types.includes('Nome quasi uguale (refuso?)'), types.join('|'));
  assert.ok(types.includes('Bambino senza adulti che vengono'), types.join('|'));
  assert.ok(types.includes('Nome mancante'), types.join('|'));
  assert.ok(!types.includes('Tutto a posto'));
  const sheet = env.sheets.Controlli.data;
  assert.strictEqual(sheet.length, issues.length + 1);
  assert.ok(sheet.some((r) => r[0] === 'Nome doppio (inviti diversi)' && /\d+, \d+/.test(r[2])));
  const dup = sheet.find((r) => r[0] === 'Nome doppio (inviti diversi)');
  assert.ok(/riga \d+ \(invito "Mario Bianchi", \d\d\/\d\d\/\d{4} \d\d:\d\d, Sì\)/.test(dup[1]), dup[1]);
  assert.ok(dup[1].includes('la più recente è la riga'), dup[1]);
});

test('seggiolone: salvato per i bimbi che vengono, riletto, in riepilogo e nella mail', () => {
  const env = seeded();
  const res = post(env, newRsvp({ people: [
    { name: 'Anna Verdi', attending: 'yes' },
    { name: 'Teo Verdi', child: true, attending: 'yes', highchair: 'no' },
    { name: 'Ida Verdi', child: true, attending: 'yes', highchair: 'yes' },
    { name: 'Gino Verdi', child: true, attending: 'no', highchair: 'yes' },       // non viene: ignorato
    { name: 'Lia Verdi', attending: 'yes', highchair: 'yes' }                    // non è un bimbo: ignorato
  ] }));
  assert.strictEqual(res.ok, true);
  assert.deepStrictEqual(res.invite.people.map((p) => p.highchair), [null, 'no', 'yes', null, null]);
  const rows = env.sheets.Invitati.data.slice(5);
  assert.deepStrictEqual(rows.map((r) => r[11]), ['', 'No', 'Sì', '', '']);
  assert.ok(env.mails[0].body.includes('Teo Verdi: ci sarà (bambino, serve un seggiolone)'), env.mails[0].body);
  assert.ok(env.mails[0].body.includes('Ida Verdi: ci sarà (bambino, porta il seggiolone)'));
  // senza il campo (vecchio sito in cache) il bimbo si salva comunque, con la cella vuota
  const old = post(env, newRsvp({ people: [{ name: 'Pia Neri', child: true, attending: 'yes' }] }));
  assert.strictEqual(old.ok, true);
  assert.strictEqual(old.invite.people[0].highchair, null);
  // modifica: da "No" a "Sì"
  const people = res.invite.people.map((p) => ({ id: p.id, name: p.name, child: p.child, attending: p.attending, highchair: p.name === 'Teo Verdi' ? 'yes' : p.highchair }));
  assert.strictEqual(post(env, newRsvp({ code: res.code, people })).ok, true);
  assert.strictEqual(env.sheets.Invitati.data[6][11], 'Sì');
});

test('setup: intestazione Seggiolone e righe di riepilogo', () => {
  const env = makeEnv();
  env.sandbox.setup();
  assert.strictEqual(env.sheets.Invitati.data[0][11], 'Seggiolone');
  const labels = env.sheets.Riepilogo.data.map((r) => r[0]);
  assert.ok(labels.includes('Bimbi senza seggiolone (da fornire)'));
  assert.ok(String(env.sheets.Riepilogo.data[labels.indexOf('Bimbi con seggiolone proprio')][1]).includes('L2:L,"Sì"'));
});

let failed = 0;
tests.forEach(([name, fn]) => {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).split('\n').slice(0, 3).join('\n     ')); }
});
console.log(failed ? `\n${failed} test falliti` : `\nTutti i ${tests.length} test passano`);
process.exit(failed ? 1 : 0);
