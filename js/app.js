(function () {
  'use strict';

  var SITE = window.SITE;
  var I18N = window.I18N;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var state = {
    lang: 'it',
    code: '',
    view: 'soon',       // soon | loading | invalid | error | form | done | closed
    open: false,        // il modulo RSVP si apre col pulsante
    info: null,         // scadenza, chiusura e IBAN, letti dal foglio
    invite: null,       // risposta già salvata (da link, dal browser o appena inviata)
    draft: null         // risposte in corso: sopravvivono al cambio lingua
  };

  /* ───── Utilità ───── */

  function store(key, value) {
    try {
      if (value === undefined) return window.localStorage.getItem(key);
      window.localStorage.setItem(key, value);
    } catch (e) { /* storage non disponibile: il sito funziona lo stesso */ }
    return null;
  }

  function t(key, vars) {
    var s = (I18N[state.lang] && I18N[state.lang][key]);
    if (s === undefined) s = I18N.it[key];
    if (s === undefined) return key;
    return String(s).replace(/\{(\w+)\}/g, function (_, k) { return vars && vars[k] !== undefined ? vars[k] : ''; });
  }

  // Crea elementi DOM; i testi entrano sempre come testo, mai come HTML.
  function h(tag, attrs) {
    var el = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      var v = attrs[k];
      if (v === false || v == null) return;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k.indexOf('on') === 0) el.addEventListener(k.slice(2), v);
      else if (v === true) el.setAttribute(k, '');
      else el.setAttribute(k, v);
    });
    Array.prototype.slice.call(arguments, 2).forEach(function add(kid) {
      if (Array.isArray(kid)) return kid.forEach(add);
      if (kid == null || kid === false) return;
      el.append(kid.nodeType ? kid : document.createTextNode(kid));
    });
    return el;
  }

  function locale() { return state.lang === 'en' ? 'en-GB' : 'it-IT'; }

  function fmtLong(date) {
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: 'Europe/Rome' }).format(date);
  }
  function fmtDeadline() {
    var src = state.invite || state.info;
    var d = src && src.deadline;
    if (!d) return '';
    var p = d.split('-');
    return new Intl.DateTimeFormat(locale(), { dateStyle: 'long', timeZone: 'UTC' })
      .format(new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])));
  }

  /* ───── Lingua ───── */

  function applyI18n() {
    document.documentElement.lang = state.lang;
    document.title = t('meta.title');
    var md = $('meta[name="description"]');
    if (md) md.setAttribute('content', t('meta.description'));

    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-attr]').forEach(function (el) {
      el.getAttribute('data-i18n-attr').split(';').forEach(function (pair) {
        var i = pair.indexOf(':');
        el.setAttribute(pair.slice(0, i), t(pair.slice(i + 1)));
      });
    });
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });
  }

  function setLang(lang, chosenByUser) {
    if (!I18N[lang]) return;
    state.lang = lang;
    if (chosenByUser) store('lang', lang);
    applyI18n();
    renderDynamic();
  }

  function pickInitialLang() {
    var q = new URLSearchParams(window.location.search).get('lang');
    if (q && I18N[q]) return q;
    var saved = store('lang');
    if (saved && I18N[saved]) return saved;
    return (navigator.language || 'it').toLowerCase().indexOf('en') === 0 ? 'en' : 'it';
  }

  /* ───── Parti che dipendono dalla lingua ───── */

  function renderDynamic() {
    renderCountdown();
    renderTimes();
    renderCalendarLinks();
    renderGreeting();
    renderRsvp();
    renderGift();
    renderGalleryLabels();
  }

  function renderCountdown() {
    var today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome' }).format(new Date());
    var a = today.split('-'), b = SITE.date.split('-');
    var days = Math.round((Date.UTC(+b[0], +b[1] - 1, +b[2]) - Date.UTC(+a[0], +a[1] - 1, +a[2])) / 86400000);
    var el = $('#countdown');
    if (days > 1) el.textContent = t('count.many', { n: days });
    else if (days === 1) el.textContent = t('count.one');
    else if (days === 0) el.textContent = t('count.today');
    else el.textContent = t('count.past');
  }

  function renderTimes() {
    $('#tl-ceremony-time').textContent = SITE.ceremonyTime;
    var rt = SITE.reception.time;
    var slot = $('#tl-reception-time');
    var when = $('#reception-when');
    if (rt) {
      slot.removeAttribute('data-i18n');
      slot.classList.add('is-time');
      slot.textContent = rt;
      when.removeAttribute('data-i18n');
      when.textContent = t('reception.whenTime', { time: rt });
    }
  }

  function mapsSearch(q) {
    return 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(q);
  }

  function setupMapsLinks() {
    $('#church-maps').href = mapsSearch(SITE.ceremony.mapsQuery);
    $('#reception-maps').href = mapsSearch(SITE.reception.mapsQuery);
    $('#route-maps').href = 'https://www.google.com/maps/dir/?api=1&origin=' +
      encodeURIComponent(SITE.ceremony.mapsQuery) + '&destination=' +
      encodeURIComponent(SITE.reception.mapsQuery) + '&travelmode=driving';
  }

  /* ───── Calendario ───── */

  function icsEscape(s) {
    return String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
  }
  function icsFold(line) {
    var out = [], enc = new TextEncoder(), cur = '', size = 0;
    Array.from(line).forEach(function (ch) {
      var n = enc.encode(ch).length;
      if (size + n > 74) { out.push(cur); cur = ' '; size = 1; }
      cur += ch; size += n;
    });
    out.push(cur);
    return out.join('\r\n');
  }

  function renderCalendarLinks() {
    var start = SITE.date.replace(/-/g, '');
    var d = new Date(Date.UTC(+SITE.date.slice(0, 4), +SITE.date.slice(5, 7) - 1, +SITE.date.slice(8, 10) + 1));
    var end = d.toISOString().slice(0, 10).replace(/-/g, '');
    var title = t('ics.title');
    var desc = t('ics.description');
    var loc = SITE.ceremony.mapsQuery;

    var lines = [
      'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//luciegigi.it//Matrimonio//IT', 'CALSCALE:GREGORIAN',
      'BEGIN:VEVENT',
      'UID:matrimonio-' + start + '@luciegigi.it',
      'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, ''),
      'DTSTART;VALUE=DATE:' + start,
      'DTEND;VALUE=DATE:' + end,
      'SUMMARY:' + icsEscape(title),
      'LOCATION:' + icsEscape(loc),
      'DESCRIPTION:' + icsEscape(desc),
      'END:VEVENT', 'END:VCALENDAR'
    ].map(icsFold).join('\r\n') + '\r\n';

    var link = $('#ics-link');
    if (link.dataset.url) URL.revokeObjectURL(link.dataset.url);
    var url = URL.createObjectURL(new Blob([lines], { type: 'text/calendar;charset=utf-8' }));
    link.dataset.url = url;
    link.href = url;
    link.setAttribute('download', 'matrimonio-lucia-luigi.ics');
  }

  /* ───── RSVP ───── */

  var MAX_PEOPLE = 12;           // uguale al limite di Code.gs
  var SAVED_KEY = 'rsvp_code';   // codice dell'ultima risposta inviata da questo browser
  var rowCounter = 0;

  function apiUrl(params) {
    var base = SITE.rsvpApi;
    return base + (base.indexOf('?') === -1 ? '?' : '&') + new URLSearchParams(params).toString();
  }

  function getJson(params) {
    return fetch(apiUrl(params)).then(function (r) { return r.json(); });
  }

  function sendRsvp(payload) {
    // text/plain evita la richiesta preliminare CORS, che Apps Script non gestisce.
    return fetch(SITE.rsvpApi, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function newRow() {
    return { key: ++rowCounter, id: '', name: '', child: false, attending: null, diet: 'none', allergies: '' };
  }

  function blankDraft() { return { people: [newRow()], message: '' }; }

  function draftFrom(inv) {
    return {
      people: inv.people.map(function (p) {
        return { key: ++rowCounter, id: p.id, name: p.name, child: !!p.child, attending: p.attending || null,
                 diet: p.diet || 'none', allergies: p.allergies || '' };
      }),
      message: inv.message || ''
    };
  }

  function setUrlCode(code) {
    try {
      var url = new URL(window.location.href);
      if (code) url.searchParams.set('invito', code); else url.searchParams.delete('invito');
      window.history.replaceState(null, '', url);
    } catch (e) { /* l'indirizzo resta com'è */ }
  }

  // Apre una risposta già inviata. `silent`: il codice viene dalla memoria del browser, non da un link o da chi l'ha scritto.
  function loadInvite(code, silent) {
    state.code = code;
    state.view = 'loading';
    renderRsvp();
    getJson({ action: 'invite', code: code }).then(function (res) {
      if (!res || !res.ok) {
        if (silent) {
          store(SAVED_KEY, '');
          state.code = '';
          state.view = 'form';
        } else {
          state.view = res && res.error === 'invalid_code' ? 'invalid' : 'error';
        }
        state.invite = null;
      } else {
        state.invite = res.invite;
        state.draft = draftFrom(res.invite);
        if (!store('lang') && res.invite.lang && I18N[res.invite.lang]) {
          state.lang = res.invite.lang;
          applyI18n();
        }
        state.view = res.invite.closed ? 'closed' : 'form';
      }
      renderDynamic();
    }).catch(function () {
      state.view = silent ? 'form' : 'error';
      if (silent) state.code = '';
      renderDynamic();
    });
  }

  function renderGreeting() {
    var el = $('#greeting');
    if (state.invite) {
      el.textContent = t('hero.greeting', { name: state.invite.greeting });
      el.hidden = false;
    } else {
      el.hidden = true;
    }
  }

  function deadlineSource() { return state.invite || state.info; }

  function renderIntro() {
    var intro = $('#rsvp-intro');
    var src = deadlineSource();
    var key = src && src.closed ? 'rsvp.introClosed' : (src && src.deadline ? 'rsvp.intro' : 'rsvp.introNoDate');
    if (state.view === 'soon') { intro.textContent = ''; return; }
    // La data di scadenza va in grassetto: si spezza il testo dove cade e la si mette in un <strong>.
    var marker = '\u0001';
    var parts = t(key, { deadline: marker }).split(marker);
    intro.replaceChildren(parts[0]);
    if (parts.length > 1) intro.append(h('strong', { text: fmtDeadline() }), parts[1]);
  }

  function renderRsvp() {
    var root = $('#rsvp-root');
    renderIntro();
    var views = { soon: viewSoon, loading: viewLoading, invalid: viewInvalid,
                  error: viewError, form: viewForm, done: viewDone, closed: viewClosed };
    var focused = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
    if (!state.open && state.view !== 'closed') {
      root.className = 'rsvp-cta';
      root.replaceChildren(h('button', { type: 'button', class: 'btn btn--light', id: 'rsvp-open', onclick: function () {
        state.open = true;
        renderRsvp();
        var first = root.querySelector('input, button, textarea');
        if (first) first.focus();
      }, text: t('rsvp.open') }));
      return;
    }
    root.className = 'sheet';
    root.replaceChildren(views[state.view]());
    if (focused) { var again = document.getElementById(focused); if (again) again.focus(); }
  }

  function viewSoon() { return h('p', { text: t('rsvp.soon') }); }
  function viewLoading() { return h('p', { text: t('rsvp.loading') }); }

  function backToForm() {
    state.view = 'form';
    state.code = '';
    state.invite = null;
    state.draft = state.draft || blankDraft();
    setUrlCode('');
    renderDynamic();
  }

  function viewInvalid() {
    return h('div', null,
      h('div', { class: 'msg msg--error', role: 'alert', text: t('rsvp.invalid') }),
      h('p', { style: 'margin-top:1rem' },
        h('button', { type: 'button', class: 'btn', onclick: backToForm, text: t('rsvp.backToForm') })));
  }

  function viewError() {
    return h('div', null,
      h('div', { class: 'msg msg--error', role: 'alert', text: t('rsvp.loadError') }),
      h('p', { style: 'margin-top:1rem' },
        h('button', { type: 'button', class: 'btn', onclick: function () { loadInvite(state.code, false); }, text: t('rsvp.retry') })));
  }

  var DIETS = ['none', 'vegetarian', 'vegan'];
  function dietLabel(d) {
    return t({ none: 'rsvp.dietNone', vegetarian: 'rsvp.dietVegetarian', vegan: 'rsvp.dietVegan' }[d]);
  }

  function personLabel(p, i) {
    return p.name.trim() || (i === 0 ? t('rsvp.you') : t('rsvp.person', { n: i + 1 }));
  }

  function personFieldset(p, i, onRemove) {
    var details;
    var fixed = !!p.id && !!p.name;   // persona già salvata: il nome resta quello

    function option(value, key) {
      return h('label', null,
        h('input', { type: 'radio', name: 'att-' + p.key, value: value, checked: p.attending === value,
          onchange: function () { p.attending = value; details.hidden = value !== 'yes'; } }),
        h('span', { text: t(key) }));
    }

    details = h('div', { class: 'details', hidden: p.attending !== 'yes' },
      h('div', { class: 'field' },
        h('label', { for: 'diet-' + p.key, text: t('rsvp.diet') }),
        h('select', { id: 'diet-' + p.key, onchange: function (e) { p.diet = e.target.value; } },
          DIETS.map(function (v) { return h('option', { value: v, selected: p.diet === v, text: dietLabel(v) }); }))),
      h('div', { class: 'field' },
        h('label', { for: 'allergies-' + p.key },
          t('rsvp.allergies'),
          h('span', { class: 'field__help', id: 'allergies-help-' + p.key, text: t('rsvp.allergiesHelp') })),
        h('input', { id: 'allergies-' + p.key, type: 'text', maxlength: '300', value: p.allergies,
          autocomplete: 'off', 'aria-describedby': 'allergies-help-' + p.key,
          oninput: function (e) { p.allergies = e.target.value; } })));

    return h('fieldset', { class: 'person', 'data-key': p.key },
      h('legend', { text: fixed ? p.name : (i === 0 ? t('rsvp.you') : t('rsvp.person', { n: i + 1 })) }),
      fixed ? null : h('div', { class: 'field' },
        h('label', { for: 'name-' + p.key, text: i === 0 ? t('rsvp.nameFirst') : t('rsvp.name') }),
        h('input', { id: 'name-' + p.key, type: 'text', maxlength: '100', value: p.name,
          autocomplete: i === 0 ? 'name' : 'off',
          oninput: function (e) { p.name = e.target.value; } })),
      h('label', { class: 'check' },
        h('input', { type: 'checkbox', checked: p.child, onchange: function (e) { p.child = e.target.checked; } }),
        h('span', { text: t('rsvp.child') })),
      h('div', { class: 'choice' }, option('yes', 'rsvp.yes'), option('no', 'rsvp.no')),
      details,
      onRemove ? h('p', { class: 'person__remove' },
        h('button', { type: 'button', class: 'linkbtn', onclick: onRemove, text: t('rsvp.remove') })) : null);
  }

  function viewForm() {
    var inv = state.invite;
    var answered = !!(inv && inv.answeredAt);
    var draft = state.draft;

    var errorBox = h('div', { id: 'rsvp-error', role: 'alert' });
    var button = h('button', { type: 'submit', class: 'btn', id: 'rsvp-submit', text: answered ? t('rsvp.update') : t('rsvp.submit') });
    var trap = h('input', { type: 'text', name: 'nickname_check', tabindex: '-1', autocomplete: 'off', 'aria-hidden': 'true' });
    var people = h('div', { id: 'rsvp-people' });
    var addButton = h('button', { type: 'button', class: 'btn btn--ghost', id: 'rsvp-add', text: t('rsvp.addPerson'),
      onclick: function () {
        var row = newRow();
        draft.people.push(row);
        renderPeople();
        var input = document.getElementById('name-' + row.key);
        if (input) input.focus();
      } });

    function renderPeople() {
      people.replaceChildren.apply(people, draft.people.map(function (p, i) {
        var removable = i > 0 && !p.id;
        return personFieldset(p, i, removable ? function () {
          draft.people.splice(draft.people.indexOf(p), 1);
          renderPeople();
        } : null);
      }));
      addButton.hidden = draft.people.length >= MAX_PEOPLE;
    }
    renderPeople();

    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      errorBox.replaceChildren();

      function problem(text, selector) {
        errorBox.append(h('div', { class: 'msg msg--error', text: text }));
        var el = form.querySelector(selector);
        if (el) el.focus();
      }

      for (var i = 0; i < draft.people.length; i++) {
        var p = draft.people[i];
        if (!p.name.trim()) { problem(t('rsvp.nameMissing'), '#name-' + p.key); return; }
        if (!p.attending) { problem(t('rsvp.missing', { name: personLabel(p, i) }), 'fieldset[data-key="' + p.key + '"] input[type="radio"]'); return; }
      }

      button.disabled = true;
      button.textContent = t('rsvp.sending');
      sendRsvp({
        action: 'rsvp',
        code: state.code,
        lang: state.lang,
        website: trap.value,
        message: draft.message,
        people: draft.people.map(function (p) {
          return { id: p.id || undefined, name: p.name.trim(), child: p.child, attending: p.attending,
                   diet: p.attending === 'yes' ? p.diet : 'none',
                   allergies: p.attending === 'yes' ? p.allergies.trim() : '' };
        })
      }).then(function (res) {
        if (res && res.ok && res.invite) {
          state.code = res.code;
          state.invite = res.invite;
          state.draft = draftFrom(res.invite);
          store(SAVED_KEY, res.code);
          setUrlCode(res.code);
          state.view = 'done';
          renderDynamic();
          var done = $('#rsvp-done');
          if (done) done.focus();
          return;
        }
        if (res && res.ok) { fail('rsvp.saveError'); return; }   // risposta scartata dal campo trappola
        if (res && res.error === 'closed') {
          state.info = Object.assign({}, state.info, { closed: true });
          if (state.invite) state.invite.closed = true;
          state.view = 'closed';
          renderDynamic();
          return;
        }
        var key = { busy: 'rsvp.busyError', full: 'rsvp.fullError', invalid_code: 'rsvp.invalid' }[res && res.error] || 'rsvp.saveError';
        fail(key);
      }).catch(function () { fail('rsvp.saveError'); });

      function fail(key) {
        button.disabled = false;
        button.textContent = answered ? t('rsvp.update') : t('rsvp.submit');
        errorBox.replaceChildren(h('div', { class: 'msg msg--error', text: t(key) }));
      }
    } },
      answered ? h('p', { class: 'sheet__hello', text: t('rsvp.hello', { name: inv.greeting }) }) : null,
      answered ? h('p', { class: 'sheet__note', text: t('rsvp.answeredOn', { date: fmtLong(new Date(inv.answeredAt)), deadline: fmtDeadline() }) }) : null,
      h('p', { class: 'sheet__note', text: t('rsvp.formHelp') }),
      h('div', { class: 'hp', 'aria-hidden': 'true' }, trap),
      people,
      h('p', { style: 'margin-top:.4rem' }, addButton),
      h('div', { class: 'field', style: 'margin-top:1.3rem' },
        h('label', { for: 'rsvp-message', text: t('rsvp.message') }),
        h('textarea', { id: 'rsvp-message', maxlength: '1000', text: draft.message,
          oninput: function (e) { draft.message = e.target.value; } })),
      h('div', { class: 'sheet__foot' }, errorBox, button));

    return form;
  }

  function summaryList(inv) {
    return h('ul', { class: 'summary' }, inv.people.map(function (p) {
      var extra = [];
      if (p.attending === 'yes' && p.diet && p.diet !== 'none') extra.push(dietLabel(p.diet));
      if (p.attending === 'yes' && p.allergies) extra.push(p.allergies);
      return h('li', null,
        h('span', { text: p.name }),
        h('span', { text: [t(p.attending === 'yes' ? 'rsvp.yesShort' : 'rsvp.noShort')].concat(extra).join(' · ') }));
    }));
  }

  function viewDone() {
    var anyYes = state.invite.people.some(function (p) { return p.attending === 'yes'; });
    return h('div', { class: 'msg', id: 'rsvp-done', tabindex: '-1', role: 'status' },
      h('p', null, h('strong', { text: t('rsvp.saved') })),
      h('p', { text: t(anyYes ? 'rsvp.savedYes' : 'rsvp.savedNo') }));
  }

  function viewClosed() {
    var inv = state.invite;
    return h('div', null,
      inv && inv.answeredAt ? summaryList(inv) : null,
      h('div', { class: 'msg', text: t('rsvp.closedNote') }));
  }

  function copyText(text, done, fail) {
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(text).then(done, fail);
    } else {
      var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
      ta.value = text;
      document.body.append(ta);
      ta.select();
      try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); }
      ta.remove();
    }
  }

  /* ───── Regalo di nozze ───── */

  function groupIban(s) { return s.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim(); }

  // L'IBAN arriva dal foglio; finché lì è vuoto si usa il segnaposto di config.js.
  function currentGift() {
    var gift = (state.invite && state.invite.gift) || (state.info && state.info.gift) || SITE.gift;
    return gift && gift.iban ? gift : null;
  }

  function renderGift() {
    var sec = $('#lista-nozze');
    var gift = currentGift();
    var visible = !!gift;
    sec.hidden = !visible;
    if (!visible) return;

    var dl = $('#gift-details');
    var rows = [];
    if (gift.holder) rows.push(['gift.holder', gift.holder, false]);
    rows.push(['gift.iban', groupIban(gift.iban), true]);
    if (gift.reason) rows.push(['gift.reason', gift.reason, false]);
    dl.replaceChildren.apply(dl, rows.map(function (r) {
      return h('div', null, h('dt', { text: t(r[0]) }), h('dd', { class: r[2] ? 'is-iban' : null, text: r[1] }));
    }));
    $('#gift-status').textContent = '';
  }

  function setupGiftCopy() {
    $('#gift-copy').addEventListener('click', function () {
      var status = $('#gift-status');
      var gift = currentGift();
      var iban = gift && gift.iban.replace(/\s+/g, '');
      if (!iban) return;
      copyText(iban,
        function () { status.textContent = t('gift.copied'); },
        function () { status.textContent = t('gift.copyError'); });
    });
  }

  /* ───── Contatti e galleria ───── */

  function setupContacts() {
    var list = SITE.contacts || [];
    if (!list.length) return;
    $('#contatti').hidden = false;
    document.querySelectorAll('[data-gated="contacts"]').forEach(function (a) { a.hidden = false; });
    $('#contacts-list').replaceChildren.apply($('#contacts-list'), list.map(function (c) {
      return h('li', null,
        h('span', { class: 'who', text: c.name }),
        c.phone ? h('div', null, h('a', { href: 'tel:' + c.phone.replace(/[^\d+]/g, ''), text: c.phone })) : null,
        c.email ? h('div', null, h('a', { href: 'mailto:' + c.email, text: c.email })) : null);
    }));
  }

  var gallery = { index: 0 };

  function photoAlt(p) { return (p.alt && (p.alt[state.lang] || p.alt.it)) || ''; }

  function setupGallery() {
    var photos = SITE.photos || [];
    if (!photos.length) return;
    $('#foto').hidden = false;
    document.querySelectorAll('[data-gated="gallery"]').forEach(function (a) { a.hidden = false; });

    var ul = $('#gallery-list');
    ul.replaceChildren.apply(ul, photos.map(function (p, i) {
      return h('li', null, h('button', { type: 'button', 'data-i': String(i), onclick: function () { openPhoto(i); } },
        h('img', { src: p.thumb || p.src, alt: photoAlt(p), loading: 'lazy', decoding: 'async' })));
    }));

    var box = $('#lightbox');
    $('#lb-close').addEventListener('click', function () { box.close(); });
    $('#lb-prev').addEventListener('click', function () { openPhoto(gallery.index - 1); });
    $('#lb-next').addEventListener('click', function () { openPhoto(gallery.index + 1); });
    box.addEventListener('click', function (e) { if (e.target === box) box.close(); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowLeft') openPhoto(gallery.index - 1);
      if (e.key === 'ArrowRight') openPhoto(gallery.index + 1);
    });
  }

  function openPhoto(i) {
    var photos = SITE.photos;
    gallery.index = (i + photos.length) % photos.length;
    var p = photos[gallery.index];
    $('#lb-stage').replaceChildren(h('img', { src: p.src, alt: photoAlt(p) }));
    var box = $('#lightbox');
    if (!box.open) box.showModal();
  }

  function renderGalleryLabels() {
    document.querySelectorAll('#gallery-list img').forEach(function (img, i) {
      img.alt = photoAlt(SITE.photos[i]);
    });
  }

  /* ───── Foto d'apertura a scorrimento ───── */

  var SLIDE_MS = 6000;   // tempo tra una foto e l'altra (la dissolvenza dura 1,2 s, vedi CSS)

  function setupHeroSlides() {
    var photos = SITE.heroPhotos || [];
    var frame = $('.hero__frame');
    var first = $('.hero__photo');
    if (photos.length < 2 || !frame || !first) return;
    // Chi ha chiesto meno movimento vede la prima foto ferma.
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    if (first.getAttribute('src') !== photos[0].src) first.setAttribute('src', photos[0].src);
    var slides = [first].concat(photos.slice(1).map(function (p) {
      var img = h('img', { class: 'hero__photo is-off', alt: '', width: first.getAttribute('width'),
        height: first.getAttribute('height'), decoding: 'async', 'data-src': p.src });
      frame.append(img);
      return img;
    }));
    var current = 0;
    var timer = null;

    // Una foto alla volta: la successiva si scarica solo quando quella corrente è già in mostra.
    function load(i) {
      if (!slides[i].getAttribute('src')) slides[i].setAttribute('src', slides[i].getAttribute('data-src'));
    }
    function next() {
      var i = (current + 1) % slides.length;
      var img = slides[i];
      if (!img.complete || !img.naturalWidth) { load(i); return; }   // non è ancora arrivata: si riprova al giro dopo
      slides.forEach(function (s, k) { s.classList.toggle('is-off', k !== i); });
      current = i;
      load((i + 1) % slides.length);
    }
    function start() { if (!timer) timer = setInterval(next, SLIDE_MS); }
    function stop() { clearInterval(timer); timer = null; }

    load(1);
    start();
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  }

  /* ───── Avvio ───── */

  function init() {
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
    });

    setupMapsLinks();
    setupGiftCopy();
    setupContacts();
    setupGallery();
    setupHeroSlides();

    state.lang = pickInitialLang();
    applyI18n();

    var code = (new URLSearchParams(window.location.search).get('invito') || '').replace(/\s+/g, '').toUpperCase();
    if (!SITE.rsvpApi) {
      state.view = 'soon';
      renderDynamic();
      return;
    }

    state.view = 'form';
    state.draft = blankDraft();
    renderDynamic();

    getJson({ action: 'info' }).then(function (res) {
      if (!res || !res.ok) return;
      state.info = res.info;
      if (state.view === 'form' && !state.invite && res.info.closed) state.view = 'closed';
      renderDynamic();
    }).catch(function () { /* senza info il sito funziona lo stesso */ });

    var remembered = code || store(SAVED_KEY);
    if (remembered) loadInvite(remembered, !code);
  }

  init();
})();
