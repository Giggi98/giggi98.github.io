# Sito del matrimonio di Lucia e Luigi — luciegigi.it

Contesto per Claude Code: stato del progetto e decisioni prese finora. Lingua di lavoro con l'utente: italiano.

## Stato attuale

- Repo `Giggi98/giggi98.github.io`, GitHub Pages dal branch `main` (root), dominio `luciegigi.it` (file CNAME).
- Dominio registrato su register.it a settembre 2026 per un anno: scade intorno a settembre 2027 (copre il matrimonio; rinnovare se si vuole tenere il sito dopo).
- **Sito scritto il 2026-10-23**, pubblicato su luciegigi.it con il commit `ee2709e`; "Enforce HTTPS" attivato il 2026-10-23. L'utente ha scelto di saltare brainstorming e spec e di partire direttamente. Vedi "Com'è fatto il sito" in basso.

## Correzioni tecniche da fare (non ancora fatte)

1. Su register.it cambiare il record CNAME `www` da `luciegigi.it` a `giggi98.github.io.`: oggi `https://www.luciegigi.it` dà errore di certificato.

## Dati dell'evento

- Sposi: **Lucia e Luigi**.
- Data: **sabato 29 maggio 2027**.
- Cerimonia: **Chiesa di Santa Maria Assunta in Borgo**, via Giuseppe Mazzini 51, 24027 Nembro (BG). Chiesa del Quattrocento (completata 1456), famosa per gli affreschi. Coordinate 45.7449407, 9.7612093.
- Ricevimento: **Castello di Monasterolo**, Piazzetta Contessa V. Terni de Gregori 1, 24060 Monasterolo del Castello (BG), sul Lago di Endine; parco botanico con 700+ specie, siepi scolpite, piscina in marmo. Coordinate 45.7583456, 9.9184287.
- Chiesa → castello: ~21,5 km, 30-35 minuti in auto (Val Cavallina).
- Aeroporto più vicino: Bergamo Orio al Serio, a pochi km da Nembro (utile per gli ospiti inglesi).
- Orari: **ancora da ricevere** dagli sposi.

## Decisioni prese

- **Tempistica:** sito completo (con RSVP aperto) il prima possibile. L'RSVP resta aperto per mesi, quindi gli ospiti devono poter **modificare** la risposta fino alla scadenza (proposta: fine aprile 2027, configurabile).
- **Lingue:** italiano + inglese, compresi form RSVP e messaggi.
- **RSVP con link personale per invito** (famiglia/coppia), es. `luciegigi.it/?invito=K7M2QX`: il sito saluta per nome, mostra le persone dell'invito già elencate, usa la lingua impostata per quell'invito.
  - Per ogni persona: partecipa sì/no + esigenze alimentari (vegetariano/vegano, allergie, intolleranze).
  - Per invito: un campo libero "messaggio per gli sposi".
  - I bambini li segnano gli sposi nella lista invitati (conteggio menù bimbi automatico).
  - Proposta da confermare: mail di notifica agli sposi a ogni risposta (disattivabile).
  - Scartati: navetta, alloggio, canzone.
- **Backend RSVP:** Google Sheet + Google Apps Script (web app) che riceve le risposte dal sito. Gratuito; il foglio si scarica in Excel. Lista invitati, codici e risposte vivono solo nel foglio.
- **Privacy: "pubblico ma discreto".** Informazioni generali visibili a chiunque abbia l'indirizzo; `noindex` (fuori da Google); IBAN e dati invitati solo nel foglio Google, restituiti dallo script solo a chi ha un codice invito valido. **La repo è pubblica: mai mettere IBAN, lista invitati o altri dati personali nel codice.**
- **Sezioni:** copertina (nomi, data, countdown, "aggiungi al calendario"), programma, **La Chiesa** (orario, indirizzo, "Apri in Maps", mappa, parcheggio), **Il Ricevimento** (idem + percorso dalla chiesa), RSVP (sezione con pulsante "RSVP" che apre il modulo; il pulsante c'è sempre; senza backend, cliccandolo compare "aprirà a breve"), regalo di nozze (solo IBAN, niente lista regali; sezione sempre visibile, IBAN con pulsante "copia"), contatti, **galleria foto**. Scartate: la sezione FAQ (tolta il 2026-10-23), "la nostra storia", "come arrivare e dormire" generale, foto degli ospiti con QR.
- **Apertura con foto a scorrimento (da fare):** al posto della singola foto del Save the Date (`assets/hero.jpg`) gli sposi vogliono una presentazione che scorre foto di loro due insieme, con un tempo ragionevole tra una foto e l'altra (idea: 5-6 s con dissolvenza, rispettando `prefers-reduced-motion`). Le foto verranno prese da una cartella o da un Drive: **ancora da decidere dove**. Il blocco `photos` di `config.js`/`optimize_photos.py` potrebbe servire da base. Prima di implementarla chiedere dove stanno le foto.
- **Foto di chiesa e ricevimento (2026-10-23):** le mappe OpenStreetMap incorporate sono state sostituite da `assets/chiesa.webp` e `assets/ricevimento.webp` (gli sposi non le gradivano); restano i pulsanti "Apri in Maps".
- **Foto:** in una cartella Google Drive dell'utente (Drive non è sincronizzato sul PC: andranno scaricate come zip). Da ridimensionare/ottimizzare per il web prima di metterle nel sito.
- **Assunzioni:** gli ospiti aprono il link da telefono via WhatsApp (mobile-first, anteprima link Open Graph curata); nessun costo oltre al dominio.

## Com'è fatto il sito

HTML/CSS/JS statico, nessuna build, nessuna dipendenza. File:

- `index.html`: struttura e meta Open Graph (statici, bilingui) + `noindex`. Le sezioni "Contatti" e "Foto" hanno `hidden` e il JS le mostra solo quando ci sono i dati.
- `js/config.js`: **unico posto da toccare per i contenuti**: URL dell'Apps Script (`rsvpApi`), orario del ricevimento (`reception.time`), contatti, foto. Mai dati personali qui (repo pubblica).
- `js/i18n.js`: tutti i testi IT/EN (`data-i18n` in HTML, `t()` in JS). L'orario "11:00" della cerimonia è nei testi `church.lead`, `church.when`, `ics.description` oltre che in `config.js`: se cambia, aggiornare anche quelli.
- `js/app.js`: lingua, countdown, calendario (.ics all-day, senza link Google Calendar: tolto), link Maps, RSVP, lista nozze, galleria con lightbox.
- `css/style.css`: stile. `fonts/` font self-hosted (Playball, Alegreya, Alegreya SC), nessuna chiamata a Google Fonts.
- `assets/`: `hero.jpg` (ritagliata dal Save the Date, 638 px: **sostituire con l'originale** quando c'è), `og.jpg` (anteprima WhatsApp 1200x630, rigenerare se cambia la foto), `favicon.svg`.
- `apps-script/`: `Code.gs` (backend RSVP, da incollare nel Google Sheet), `appsscript.json`, `README.md` (installazione passo-passo), `mock.js` + `test.js` (`node apps-script/test.js`, 11 test su un finto foglio).
- `tools/optimize_photos.py`: ridimensiona le foto, toglie i metadati GPS, stampa il blocco `photos` per `config.js`.
- `_config.yml`: esclude da Pages CLAUDE.md, README, apps-script, tools.

**Stile (deciso il 2026-10-23, riprende il Save the Date):** cielo `#8cb9ce` (sfondo del Save the Date), inchiostro `#1e3a4c`, coperta `#335c72`, carta `#f6fafc`, pesca `#e0af9e` solo per dettagli. Nomi in Playball bianco con ombra, leggermente inclinati (-3,5°) e con la "&" piccola e dritta in Alegreya, sovrapposti alla foto come sulla card (il carattere esatto del Save the Date non è noto: Playball è il più vicino trovato); doppio filetto sotto i titoli come sotto la data. L'apertura riproduce il Save the Date; il resto è sobrio su fondo chiaro.

**Protocollo RSVP:** `GET <exec>?action=invite&code=XXXXXX` → `{ok, invite:{greeting, lang, people[{id,name,child,attending,diet,allergies}], message, answeredAt, deadline, closed, gift}}`; `POST <exec>` con body `text/plain` JSON `{action:'rsvp', code, message, people[{id,attending,diet,allergies}]}` → `{ok, answeredAt}` o `{ok:false, error: invalid_code|invalid_data|closed|busy}`. Il POST è `text/plain` apposta, per evitare il preflight CORS che Apps Script non gestisce.

**Anteprima senza backend:** con `rsvpApi` vuoto, `?invito=DEMO` mostra un invito finto (non salva nulla). Senza API e senza DEMO la sezione RSVP dice "aprirà a breve". Quando si imposta `rsvpApi` il DEMO smette di funzionare da solo.

**Collaudi fatti (2026-10-23):** `node apps-script/test.js` (11/11); browser headless Chrome contro `Code.gs` esposto da un server locale (invio, modifica, ricarica, cambio lingua con dati a metà, errore di rete, scadenza); screenshot mobile 390 px e desktop 1280 px. **Non verificato:** il comportamento reale di CORS/redirect di Apps Script (serve il deploy), le mappe OpenStreetMap incorporate (in headless non caricavano i tile), l'anteprima del link su WhatsApp (serve il sito pubblicato), VoiceOver/TalkBack.

## Domande aperte

- **Per andare online:** (1) creare il Google Sheet e fare il deploy seguendo `apps-script/README.md`, incollare l'URL `/exec` in `js/config.js`; (2) fare una risposta di prova da telefono e controllare che arrivi nel foglio; (3) commit + push; (4) le due correzioni HTTPS/`www` qui sopra.
- **Testi/dati mancanti:** orario del ricevimento, contatti da mostrare (la sezione compare da sola quando si riempie `contacts`), dress code, parcheggio alla chiesa, scadenza RSVP definitiva (oggi `2027-04-30` nel foglio `Config`), foto per la galleria, foto originale ad alta risoluzione per l'apertura, IBAN vero (oggi segnaposto `XXXX…` in `js/config.js`, intestatario Luigi Cagliani: con un invito valido il sito usa invece quello del foglio `Config`; se resta in `config.js` è pubblico).
- **Stile grafico (storico, ora superato):** gli sposi non avevano un'idea. Hanno rifiutato il visual companion del brainstorming; preferivano guardare template reali. Riferimenti mandati:
  - Editoriale minimal: https://ceremony.framer.website/ , https://darling.framer.website/ (i domini `framer.website` sono bloccati dalla rete di casa: aprire da telefono)
  - Botanico/paesaggio: Zola Galata, Eastwick, Camden (`https://www.zola.com/wedding-planning/website/design/<nome>`)
  - Classico elegante: Zola Abbey, Verona (`.../design/abbey`, `.../design/verona-black`)
  - Romantico morbido: https://noahsabrinalove.framer.website/
  - Solo funzionamento RSVP a codice: https://wedding.rampatra.com (codice 271117)
- Orari di cerimonia e ricevimento; testi (dress code); contatti da mostrare; IBAN e intestatario (andranno nel foglio, non qui).

## Prossimi passi

1. Guardare il sito con Luigi (`python -m http.server` nella cartella, poi `http://localhost:8000/?invito=DEMO`) e raccogliere le correzioni.
2. Deploy del backend (vedi "Domande aperte"), prova reale, poi pubblicare.
3. Riempire i dati mancanti in `js/config.js` e `js/i18n.js`; aggiungere le foto con `tools/optimize_photos.py`.
4. Prima di mandare i link: generare i codici nel foglio, provare almeno un link su iPhone e uno su Android aperti da WhatsApp.

## Ricerca utile

- Checklist contenuti: https://withjoy.com/blog/what-to-put-on-your-wedding-website-the-complete-checklist/
- Specifiche italiane (IBAN, allergie, mappe): https://www.matrimonio.com/articoli/sito-internet-di-matrimonio--c3266
- RSVP Apps Script + Sheet: https://github.com/nequals30/googleAppsScriptRSVP , https://github.com/LorenzoLabs/wedding-planner (link personale `?g=`, bilingue), https://github.com/rampatra/wedding-website
- Nota tecnica: per leggere la risposta dell'Apps Script dal sito evitare il preflight CORS (POST con body `text/plain` o form-urlencoded, niente header JSON); da verificare con un test reale.
