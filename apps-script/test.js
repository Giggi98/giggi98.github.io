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

test('IBAN restituito solo con codice valido', () => {
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

let failed = 0;
tests.forEach(([name, fn]) => {
  try { fn(); console.log('ok   ' + name); } catch (e) { failed++; console.log('FAIL ' + name + '\n     ' + (e.stack || e).split('\n').slice(0, 3).join('\n     ')); }
});
console.log(failed ? `\n${failed} test falliti` : `\nTutti i ${tests.length} test passano`);
process.exit(failed ? 1 : 0);
