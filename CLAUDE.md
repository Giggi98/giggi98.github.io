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
- **RSVP con link unico per tutti (deciso il 2026-10-23, sostituisce i link personali):** gli sposi mandano a tutti lo stesso indirizzo `luciegigi.it` via WhatsApp. Il modulo chiede nome e cognome di chi risponde e permette di aggiungere le persone che vengono con lui (fino a 12). Alla prima risposta lo script crea un invito con un codice; il sito lo ricorda nel browser (`localStorage`, chiave `rsvp_code`), così chi riapre `luciegigi.it` e preme RSVP ritrova la risposta compilata e può **modificarla**. Il link `?invito=CODICE` esiste ancora (colonna `Link` del foglio) ma **non viene mostrato agli invitati** (scelta di Luigi, 2026-10-23). Chi risponde da un altro telefono/browser crea un secondo invito con lo stesso nome: i doppioni si risolvono nel foglio (nomi in rosso, rapporto `Controlli` che indica la riga più recente, riga `Riepilogo`).
  - Per ogni persona: partecipa sì/no + esigenze alimentari (vegetariano/vegano, allergie, intolleranze).
  - Per invito: un campo libero "messaggio per gli sposi".
  - Dopo l'invio l'invitato vede solo il ringraziamento (niente riepilogo né link per modificare: scelta di Luigi, 2026-10-25).
  - Bambini: li segna l'invitato con la casella "Bambino/a (menù bimbi)" (conteggio menù bimbi automatico nel foglio `Riepilogo`).
  - Proposta da confermare: mail di notifica agli sposi a ogni risposta (disattivabile).
  - Scartati: navetta, alloggio, canzone.
- **Backend RSVP:** Google Sheet + Google Apps Script (web app) che riceve le risposte dal sito. Gratuito; il foglio si scarica in Excel. Risposte e codici vivono solo nel foglio; i link personali pre-generati dal menu "Genera codici e link" restano possibili ma non servono più.
- **Privacy: "pubblico ma discreto".** Informazioni generali visibili a chiunque abbia l'indirizzo; `noindex` (fuori da Google). Con il link unico **IBAN, scadenza e stato (chiuso/aperto) sono pubblici**: li restituisce `?action=info` a chiunque. L'IBAN vero sta nel foglio `Config`, non nella repo; le risposte degli invitati escono dallo script solo con il codice della risposta. Antispam: campo trappola nascosto, massimo 12 persone per risposta, massimo 600 righe in `Invitati`. **La repo è pubblica: mai mettere IBAN, liste di invitati o altri dati personali nel codice.**
- **Sezioni:** copertina (nomi, data, countdown, "aggiungi al calendario"), programma, **La Chiesa** (orario, indirizzo, "Apri in Maps", mappa, parcheggio), **Il Ricevimento** (idem + percorso dalla chiesa), RSVP (sezione con pulsante "RSVP" che apre il modulo; il pulsante c'è sempre; senza backend, cliccandolo compare "aprirà a breve"), **viaggio di nozze** (aggiunta il 2026-10-25: Tokyo 2-8 giugno, Kyoto 8-11, Osaka 11-13, Koh Samui 13-18, "itinerario di massima"; testi in `i18n.js` chiavi `trip.*`, date da aggiornare quando Luigi manda i dettagli), regalo di nozze (solo IBAN, niente lista regali; sezione sempre visibile, IBAN con pulsante "copia"), contatti, **galleria foto** (58 foto in `photos/`, tutte quelle dello zip del Drive tranne 4 scartate; compare con il pulsante "Guarda le foto" accanto a RSVP in apertura). Scartate: la sezione FAQ (tolta il 2026-10-23), "la nostra storia", "come arrivare e dormire" generale, foto degli ospiti con QR.
- **Apertura con foto a scorrimento (fatta il 2026-10-25):** al posto della singola foto del Save the Date scorrono 15 foto di Lucia e Luigi (`assets/hero/01..15.jpg`, 1200x800, senza metadati), una ogni 6 s con dissolvenza di 1,2 s (`SLIDE_MS` in `app.js`; ferma con `prefers-reduced-motion`; in pausa a scheda nascosta; ne scarica una alla volta). Scelte da Claude tra le 62 della cartella privata del Drive di Luigi ("Matrimonio > Foto Luci&Gigi") guardando le anteprime: da cambiare se Luigi preferisce altre. Per rifarlo: scaricare lo zip, `pip install pillow pillow-heif` (nota: su questo PC `python` è quello di Inkscape, senza pip: usare il Python 3.11 di WindowsApps), `python tools/optimize_photos.py CARTELLA --hero --sheet anteprima.jpg`, scegliere le foto, aggiornare `heroPhotos` in `js/config.js` e il primo `src` in `index.html`. Se `heroPhotos` ha meno di 2 foto resta ferma la prima. **`assets/og.jpg` (anteprima WhatsApp) è ancora ricavata dalla foto del Save the Date**: rigenerarla se si vuole cambiare.
- **Foto di chiesa e ricevimento (2026-10-23):** le mappe OpenStreetMap incorporate sono state sostituite da `assets/chiesa.webp` e `assets/ricevimento.webp` (gli sposi non le gradivano); restano i pulsanti "Apri in Maps".
- **Foto:** in una cartella Google Drive dell'utente (Drive non è sincronizzato sul PC: andranno scaricate come zip). Da ridimensionare/ottimizzare per il web prima di metterle nel sito.
- **Assunzioni:** gli ospiti aprono il link da telefono via WhatsApp (mobile-first, anteprima link Open Graph curata); nessun costo oltre al dominio.

## Com'è fatto il sito

HTML/CSS/JS statico, nessuna build, nessuna dipendenza. File:

- `index.html`: struttura e meta Open Graph (statici, bilingui) + `noindex`. Le sezioni "Contatti" e "Foto" hanno `hidden` e il JS le mostra solo quando ci sono i dati.
- `js/config.js`: **unico posto da toccare per i contenuti**: URL dell'Apps Script (`rsvpApi`), orario del ricevimento (`reception.time`), contatti, foto. Mai dati personali qui (repo pubblica).
- `js/i18n.js`: tutti i testi IT/EN (`data-i18n` in HTML, `t()` in JS). L'orario "11:00" della cerimonia è nei testi `church.lead`, `church.when`, `ics.description` oltre che in `config.js`: se cambia, aggiornare anche quelli.
- `js/app.js`: lingua, countdown, foto d'apertura a scorrimento, calendario (.ics all-day, senza link Google Calendar: tolto), link Maps, RSVP, lista nozze, galleria con lightbox.
- `css/style.css`: stile. `fonts/` font self-hosted (Playball, Alegreya, Alegreya SC), nessuna chiamata a Google Fonts.
- `assets/`: `hero/` (foto che scorrono nell'apertura), `chiesa.webp`, `ricevimento.webp`, `og.jpg` (anteprima WhatsApp 1200x630, rigenerare se cambia la foto), `favicon.svg`.
- `apps-script/`: `Code.gs` (backend RSVP, da incollare nel Google Sheet), `appsscript.json`, `README.md` (installazione passo-passo), `mock.js` + `test.js` (`node apps-script/test.js`, 19 test su un finto foglio).
- `tools/optimize_photos.py`: ridimensiona le foto, toglie i metadati GPS, stampa il blocco `photos` per `config.js`.
- `_config.yml`: esclude da Pages CLAUDE.md, README, apps-script, tools.

**Stile (deciso il 2026-10-23, riprende il Save the Date):** cielo `#8cb9ce` (sfondo del Save the Date), inchiostro `#1e3a4c`, coperta `#335c72`, carta `#f6fafc`, pesca `#e0af9e` solo per dettagli. Nomi in Playball bianco con ombra, leggermente inclinati (-3,5°) e con la "&" piccola e dritta in Alegreya, sovrapposti alla foto come sulla card (il carattere esatto del Save the Date non è noto: Playball è il più vicino trovato); doppio filetto sotto i titoli come sotto la data. L'apertura riproduce il Save the Date; il resto è sobrio su fondo chiaro.

**Protocollo RSVP:** `GET <exec>?action=info` → `{ok, info:{deadline, closed, gift}}` (pubblico); `GET <exec>?action=invite&code=XXXXXX` → `{ok, invite:{greeting, lang, people[{id,name,child,attending,diet,allergies}], message, answeredAt, deadline, closed, gift}}`; `POST <exec>` con body `text/plain` JSON `{action:'rsvp', code?, lang, website (campo trappola, deve restare vuoto), message, people[{id?, name, child, attending, diet, allergies}]}` → `{ok, code, answeredAt, invite}` o `{ok:false, error: invalid_code|invalid_data|closed|busy|full}`. Senza `code` crea una nuova risposta; con `code` la modifica: tutte le persone già salvate devono essere nell'elenco (con `id`), quelle senza `id` vengono aggiunte, nessuna riga si cancella (chi non viene si segna "No"). Il POST è `text/plain` apposta, per evitare il preflight CORS che Apps Script non gestisce.

**Senza backend:** con `rsvpApi` vuoto la sezione RSVP mostra il pulsante e, cliccandolo, "aprirà a breve". Il vecchio `?invito=DEMO` non esiste più. `rsvpApi` è impostato dal 2026-10-23 (deploy Apps Script fatto da Luigi). **Dopo ogni modifica a `Code.gs` bisogna incollarlo nel foglio e rifare il deploy** (Distribuisci > Gestisci distribuzioni > Nuova versione): l'URL resta lo stesso.

**Collaudi fatti (2026-10-23):** `node apps-script/test.js` (19/19); browser headless Chrome contro `Code.gs` esposto da un server locale (invio, modifica, ricarica, cambio lingua con dati a metà, errore di rete, scadenza); screenshot mobile 390 px e desktop 1280 px. **Non verificato:** il comportamento reale di CORS/redirect di Apps Script (serve il deploy), le mappe OpenStreetMap incorporate (in headless non caricavano i tile), l'anteprima del link su WhatsApp (serve il sito pubblicato), VoiceOver/TalkBack.

## Domande aperte

- **Per andare online:** (1) creare il Google Sheet e fare il deploy seguendo `apps-script/README.md`, incollare l'URL `/exec` in `js/config.js`; (2) fare una risposta di prova da telefono e controllare che arrivi nel foglio; (3) commit + push; (4) le due correzioni HTTPS/`www` qui sopra.
- **Testi/dati mancanti:** orario del ricevimento, contatti da mostrare (la sezione compare da sola quando si riempie `contacts`), dress code, parcheggio alla chiesa, scadenza RSVP definitiva (oggi `2027-04-30` nel foglio `Config`), foto per la galleria, foto originale ad alta risoluzione per l'apertura, IBAN vero (va scritto nel foglio `Config`, righe `iban` e `intestatario`; finché lì è vuoto il sito mostra il segnaposto `XXXX…` di `js/config.js`).
- **Stile grafico (storico, ora superato):** gli sposi non avevano un'idea. Hanno rifiutato il visual companion del brainstorming; preferivano guardare template reali. Riferimenti mandati:
  - Editoriale minimal: https://ceremony.framer.website/ , https://darling.framer.website/ (i domini `framer.website` sono bloccati dalla rete di casa: aprire da telefono)
  - Botanico/paesaggio: Zola Galata, Eastwick, Camden (`https://www.zola.com/wedding-planning/website/design/<nome>`)
  - Classico elegante: Zola Abbey, Verona (`.../design/abbey`, `.../design/verona-black`)
  - Romantico morbido: https://noahsabrinalove.framer.website/
  - Solo funzionamento RSVP a codice: https://wedding.rampatra.com (codice 271117)
- Orari di cerimonia e ricevimento; testi (dress code); contatti da mostrare; IBAN e intestatario (andranno nel foglio, non qui).

## Prossimi passi

1. Guardare il sito con Luigi (`python -m http.server` nella cartella, poi `http://localhost:8000/`) e raccogliere le correzioni.
2. Aggiornare lo script nel foglio con il nuovo `Code.gs` e rifare il deploy (vedi "Senza backend"), poi una risposta di prova da telefono.
3. Riempire i dati mancanti in `js/config.js` e `js/i18n.js`; aggiungere le foto con `tools/optimize_photos.py`.
4. Prima di mandare il messaggio: compilare `Config` nel foglio (scadenza, mail di notifica, IBAN), provare il sito su iPhone e su Android aperto da WhatsApp, cancellare dal foglio le risposte di prova.

## Ricerca utile

- Checklist contenuti: https://withjoy.com/blog/what-to-put-on-your-wedding-website-the-complete-checklist/
- Specifiche italiane (IBAN, allergie, mappe): https://www.matrimonio.com/articoli/sito-internet-di-matrimonio--c3266
- RSVP Apps Script + Sheet: https://github.com/nequals30/googleAppsScriptRSVP , https://github.com/LorenzoLabs/wedding-planner (link personale `?g=`, bilingue), https://github.com/rampatra/wedding-website
- Nota tecnica: per leggere la risposta dell'Apps Script dal sito evitare il preflight CORS (POST con body `text/plain` o form-urlencoded, niente header JSON); da verificare con un test reale.
