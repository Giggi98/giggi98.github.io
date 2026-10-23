(function () {
  'use strict';

  var SITE = window.SITE;
  var I18N = window.I18N;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  var state = {
    lang: 'it',
    code: '',
    view: 'entry',      // soon | entry | loading | invalid | error | form | done | closed
    open: false,        // il modulo RSVP si apre col pulsante
    invite: null,
    draft: null,        // risposte in corso: sopravvivono al cambio lingua
    demo: false
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
    var d = state.invite && state.invite.deadline;
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

    $('#gcal-link').href = 'https://calendar.google.com/calendar/render?action=TEMPLATE' +
      '&text=' + encodeURIComponent(title) +
      '&dates=' + start + '/' + end +
      '&details=' + encodeURIComponent(desc) +
      '&location=' + encodeURIComponent(loc);
  }

  /* ───── Invito personale e RSVP ───── */

  function demoInvite() {
    return {
      greeting: state.lang === 'en' ? 'Demo family' : 'Famiglia Demo',
      lang: state.lang,
      people: [
        { id: 'd1', name: 'Anna', child: false, attending: null, diet: 'none', allergies: '' },
        { id: 'd2', name: 'Marco', child: false, attending: null, diet: 'none', allergies: '' },
        { id: 'd3', name: 'Sofia', child: true, attending: null, diet: 'none', allergies: '' }
      ],
      message: '',
      answeredAt: null,
      deadline: '2027-04-30',
      closed: false,
      gift: { iban: 'IT00 X000 0000 0000 0000 0000 000', holder: 'Lucia e Luigi', reason: 'Regalo di nozze' }
    };
  }

  function apiUrl(params) {
    var base = SITE.rsvpApi;
    return base + (base.indexOf('?') === -1 ? '?' : '&') + new URLSearchParams(params).toString();
  }

  function fetchInvite(code) {
    if (!SITE.rsvpApi) {
      return Promise.resolve(code === 'DEMO' ? { ok: true, invite: demoInvite() } : { ok: false, error: 'invalid_code' });
    }
    return fetch(apiUrl({ action: 'invite', code: code }))
      .then(function (r) { return r.json(); });
  }

  function sendRsvp(payload) {
    if (!SITE.rsvpApi) {
      return new Promise(function (resolve) {
        setTimeout(function () { resolve({ ok: true, answeredAt: new Date().toISOString() }); }, 400);
      });
    }
    // text/plain evita la richiesta preliminare CORS, che Apps Script non gestisce.
    return fetch(SITE.rsvpApi, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    }).then(function (r) { return r.json(); });
  }

  function loadInvite(code) {
    state.code = code;
    state.demo = !SITE.rsvpApi && code === 'DEMO';
    state.view = 'loading';
    renderRsvp();
    fetchInvite(code).then(function (res) {
      if (!res || !res.ok) {
        state.view = res && res.error === 'invalid_code' ? 'invalid' : 'error';
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
      state.view = 'error';
      renderDynamic();
    });
  }

  function draftFrom(inv) {
    var people = {};
    inv.people.forEach(function (p) {
      people[p.id] = { attending: p.attending || null, diet: p.diet || 'none', allergies: p.allergies || '' };
    });
    return { people: people, message: inv.message || '' };
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

  function renderIntro() {
    var intro = $('#rsvp-intro');
    var inv = state.invite;
    if (state.view === 'soon') intro.textContent = '';
    else if (inv && inv.closed) intro.textContent = t('rsvp.introClosed', { deadline: fmtDeadline() });
    else if (inv) intro.textContent = t('rsvp.intro', { deadline: fmtDeadline() });
    else intro.textContent = t('rsvp.introNoDate');
  }

  function renderRsvp() {
    var root = $('#rsvp-root');
    renderIntro();
    var views = { soon: viewSoon, entry: viewEntry, loading: viewLoading, invalid: viewInvalid,
                  error: viewError, form: viewForm, done: viewDone, closed: viewClosed };
    var focused = document.activeElement && root.contains(document.activeElement) ? document.activeElement.id : '';
    if (!state.open && state.view !== 'soon' && state.view !== 'closed') {
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

  function viewEntry(message) {
    var input = h('input', { id: 'code-input', type: 'text', autocomplete: 'off', autocapitalize: 'characters',
      spellcheck: 'false', maxlength: '20', 'aria-describedby': 'code-help' });
    return h('form', { class: 'codeform', onsubmit: function (e) {
        e.preventDefault();
        var code = input.value.replace(/\s+/g, '').toUpperCase();
        if (!code) { input.focus(); return; }
        var url = new URL(window.location.href);
        url.searchParams.set('invito', code);
        window.history.replaceState(null, '', url);
        loadInvite(code);
      } },
      h('div', { class: 'field' },
        h('label', { for: 'code-input', text: t('rsvp.codeLabel') }),
        input),
      h('button', { type: 'submit', class: 'btn', text: t('rsvp.codeButton') }),
      h('p', { class: 'field__help', id: 'code-help', text: t('rsvp.codeHelp') }),
      message || null);
  }

  function viewInvalid() {
    return h('div', null,
      h('div', { class: 'msg msg--error', role: 'alert', text: t('rsvp.invalid') }),
      h('p', null, h('button', { type: 'button', class: 'linkbtn', onclick: function () {
        state.view = 'entry'; state.code = '';
        var url = new URL(window.location.href);
        url.searchParams.delete('invito');
        window.history.replaceState(null, '', url);
        renderRsvp();
      }, text: t('rsvp.codeButton') })));
  }

  function viewError() {
    return h('div', null,
      h('div', { class: 'msg msg--error', role: 'alert', text: t('rsvp.loadError') }),
      h('p', { style: 'margin-top:1rem' },
        h('button', { type: 'button', class: 'btn', onclick: function () { loadInvite(state.code); }, text: t('rsvp.retry') })));
  }

  var DIETS = ['none', 'vegetarian', 'vegan'];
  function dietLabel(d) {
    return t({ none: 'rsvp.dietNone', vegetarian: 'rsvp.dietVegetarian', vegan: 'rsvp.dietVegan' }[d]);
  }

  function personFieldset(p, i) {
    var d = state.draft.people[p.id];
    var details;

    function option(value, key) {
      return h('label', null,
        h('input', { type: 'radio', name: 'att-' + p.id, value: value, checked: d.attending === value,
          onchange: function () { d.attending = value; details.hidden = value !== 'yes'; } }),
        h('span', { text: t(key) }));
    }

    var dietSelect = h('select', { id: 'diet-' + i, onchange: function (e) { d.diet = e.target.value; } },
      DIETS.map(function (v) { return h('option', { value: v, selected: d.diet === v, text: dietLabel(v) }); }));
    var allergies = h('input', { id: 'allergies-' + i, type: 'text', maxlength: '300', value: d.allergies,
      autocomplete: 'off', 'aria-describedby': 'allergies-help-' + i,
      oninput: function (e) { d.allergies = e.target.value; } });

    details = h('div', { class: 'details', hidden: d.attending !== 'yes' },
      h('div', { class: 'field' }, h('label', { for: 'diet-' + i, text: t('rsvp.diet') }), dietSelect),
      h('div', { class: 'field' },
        h('label', { for: 'allergies-' + i },
          t('rsvp.allergies'),
          h('span', { class: 'field__help', id: 'allergies-help-' + i, text: t('rsvp.allergiesHelp') })),
        allergies));

    return h('fieldset', { class: 'person', 'data-id': p.id },
      h('legend', null, p.name, p.child ? h('span', { class: 'badge', text: t('rsvp.child') }) : null),
      h('div', { class: 'choice' }, option('yes', 'rsvp.yes'), option('no', 'rsvp.no')),
      details);
  }

  function viewForm() {
    var inv = state.invite;
    var answered = !!inv.answeredAt;

    var errorBox = h('div', { id: 'rsvp-error', role: 'alert' });
    var button = h('button', { type: 'submit', class: 'btn', id: 'rsvp-submit', text: answered ? t('rsvp.update') : t('rsvp.submit') });

    var form = h('form', { novalidate: true, onsubmit: function (e) {
      e.preventDefault();
      errorBox.replaceChildren();

      var missing = inv.people.filter(function (p) { return !state.draft.people[p.id].attending; })[0];
      if (missing) {
        errorBox.append(h('div', { class: 'msg msg--error', text: t('rsvp.missing', { name: missing.name }) }));
        var first = form.querySelector('fieldset[data-id="' + missing.id + '"] input');
        if (first) first.focus();
        return;
      }

      button.disabled = true;
      button.textContent = t('rsvp.sending');
      sendRsvp({
        action: 'rsvp',
        code: state.code,
        message: state.draft.message,
        people: inv.people.map(function (p) {
          var d = state.draft.people[p.id];
          return { id: p.id, attending: d.attending,
                   diet: d.attending === 'yes' ? d.diet : 'none',
                   allergies: d.attending === 'yes' ? d.allergies.trim() : '' };
        })
      }).then(function (res) {
        if (res && res.ok) {
          inv.answeredAt = res.answeredAt || new Date().toISOString();
          inv.message = state.draft.message;
          inv.people.forEach(function (p) {
            var d = state.draft.people[p.id];
            p.attending = d.attending;
            p.diet = d.attending === 'yes' ? d.diet : 'none';
            p.allergies = d.attending === 'yes' ? d.allergies.trim() : '';
          });
          state.draft = draftFrom(inv);
          state.view = 'done';
          renderRsvp();
          var done = $('#rsvp-done');
          if (done) done.focus();
          return;
        }
        var key = { closed: 'rsvp.closedError', busy: 'rsvp.busyError', invalid_code: 'rsvp.invalid' }[res && res.error] || 'rsvp.saveError';
        if (res && res.error === 'closed') { inv.closed = true; state.view = 'closed'; renderRsvp(); return; }
        fail(key);
      }).catch(function () { fail('rsvp.saveError'); });

      function fail(key) {
        button.disabled = false;
        button.textContent = answered ? t('rsvp.update') : t('rsvp.submit');
        errorBox.replaceChildren(h('div', { class: 'msg msg--error', text: t(key) }));
      }
    } },
      h('p', { class: 'sheet__hello', text: t('rsvp.hello', { name: inv.greeting }) }),
      state.demo ? h('div', { class: 'msg msg--demo', text: t('rsvp.demo') }) : null,
      answered ? h('p', { class: 'sheet__note', text: t('rsvp.answeredOn', { date: fmtLong(new Date(inv.answeredAt)), deadline: fmtDeadline() }) }) : null,
      inv.people.map(personFieldset),
      h('div', { class: 'field', style: 'margin-top:1.3rem' },
        h('label', { for: 'rsvp-message', text: t('rsvp.message') }),
        h('textarea', { id: 'rsvp-message', maxlength: '1000', text: state.draft.message,
          oninput: function (e) { state.draft.message = e.target.value; } })),
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
    var inv = state.invite;
    var anyYes = inv.people.some(function (p) { return p.attending === 'yes'; });
    return h('div', null,
      h('div', { class: 'msg', id: 'rsvp-done', tabindex: '-1', role: 'status' },
        h('p', null, h('strong', { text: t('rsvp.saved') })),
        h('p', { text: t(anyYes ? 'rsvp.savedYes' : 'rsvp.savedNo') })),
      summaryList(inv),
      h('p', { style: 'margin-top:1.2rem' },
        h('button', { type: 'button', class: 'linkbtn', onclick: function () { state.view = 'form'; renderRsvp(); }, text: t('rsvp.changeLink') })));
  }

  function viewClosed() {
    var inv = state.invite;
    return h('div', null,
      inv.answeredAt ? summaryList(inv) : null,
      h('div', { class: 'msg', text: t('rsvp.closedNote') }));
  }

  /* ───── Lista nozze (solo con invito valido) ───── */

  function groupIban(s) { return s.replace(/\s+/g, '').replace(/(.{4})/g, '$1 ').trim(); }

  function renderGift() {
    var sec = $('#lista-nozze');
    var gift = state.invite && state.invite.gift;
    var visible = !!(gift && gift.iban);
    sec.hidden = !visible;
    document.querySelectorAll('[data-gated="gift"]').forEach(function (a) { a.hidden = !visible; });
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
      var iban = state.invite && state.invite.gift && state.invite.gift.iban.replace(/\s+/g, '');
      if (!iban) return;
      var done = function () { status.textContent = t('gift.copied'); };
      var fail = function () { status.textContent = t('gift.copyError'); };
      if (navigator.clipboard && window.isSecureContext) {
        navigator.clipboard.writeText(iban).then(done, fail);
      } else {
        var ta = h('textarea', { 'aria-hidden': 'true', style: 'position:fixed;opacity:0' });
        ta.value = iban;
        document.body.append(ta);
        ta.select();
        try { document.execCommand('copy') ? done() : fail(); } catch (e) { fail(); }
        ta.remove();
      }
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

  /* ───── Avvio ───── */

  function init() {
    document.querySelectorAll('.lang button').forEach(function (b) {
      b.addEventListener('click', function () { setLang(b.getAttribute('data-lang'), true); });
    });

    setupMapsLinks();
    setupGiftCopy();
    setupContacts();
    setupGallery();

    state.lang = pickInitialLang();
    applyI18n();

    var code = (new URLSearchParams(window.location.search).get('invito') || '').replace(/\s+/g, '').toUpperCase();
    if (!SITE.rsvpApi && code !== 'DEMO') {
      state.view = 'soon';
      renderDynamic();
    } else if (code) {
      renderDynamic();
      loadInvite(code);
    } else {
      state.view = 'entry';
      renderDynamic();
    }
  }

  init();
})();
