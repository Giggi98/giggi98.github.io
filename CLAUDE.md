# Sito del matrimonio di Lucia e Luigi — luciegigi.it

Contesto per Claude Code: stato del progetto e decisioni prese finora. Lingua di lavoro con l'utente: italiano.

## Stato attuale

- Repo `Giggi98/giggi98.github.io`, GitHub Pages dal branch `main` (root), dominio `luciegigi.it` (file CNAME).
- Il sito oggi è solo un `index.html` con "hello". Niente codice del sito ancora scritto.
- Dominio registrato su register.it a settembre 2026 per un anno: scade intorno a settembre 2027 (copre il matrimonio; rinnovare se si vuole tenere il sito dopo).
- **Siamo in fase di brainstorming/design** (skill `superpowers:brainstorming`, percorso architetturale): nessun codice finché la spec non è approvata. Prossimi passi elencati in fondo.

## Correzioni tecniche da fare (non ancora fatte)

1. Attivare "Enforce HTTPS" nelle impostazioni Pages della repo (oggi `http://luciegigi.it` non reindirizza a https).
2. Su register.it cambiare il record CNAME `www` da `luciegigi.it` a `giggi98.github.io.`: oggi `https://www.luciegigi.it` dà errore di certificato.

## Dati dell'evento

- Sposi: **Lucia e Luigi**.
- Data: **sabato 29 maggio 2027**.
- Cerimonia: **Chiesa di Santa Maria Assunta in Borgo**, via Giuseppe Mazzini 51, 24027 Nembro (BG). Chiesa del Quattrocento (completata 1456), famosa per gli affreschi. Coordinate 45.7449407, 9.7612093.
- Ricevimento: **Castello di Monasterolo**, Piazzetta Contessa V. Terni de Gregori 1, 24060 Monasterolo del Castello (BG), sul Lago di Endine; parco botanico con 700+ specie, siepi scolpite, piscina in marmo. Coordinate 45.7583456, 9.9184287.
- Chiesa → castello: ~21,5 km, 30-35 minuti in auto (Val Cavallina).
- Aeroporto più vicino: Bergamo Orio al Serio, a pochi km da Nembro (utile nelle FAQ per gli ospiti inglesi).
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
- **Sezioni:** copertina (nomi, data, countdown, "aggiungi al calendario"), programma, **La Chiesa** (orario, indirizzo, "Apri in Maps", mappa, parcheggio), **Il Ricevimento** (idem + percorso dalla chiesa), RSVP, lista nozze (IBAN con pulsante "copia", solo con link personale), FAQ (dress code, bambini, aeroporto…), contatti, **galleria foto**. Scartate: "la nostra storia", "come arrivare e dormire" generale, foto degli ospiti con QR.
- **Foto:** in una cartella Google Drive dell'utente (Drive non è sincronizzato sul PC: andranno scaricate come zip). Da ridimensionare/ottimizzare per il web prima di metterle nel sito.
- **Assunzioni:** gli ospiti aprono il link da telefono via WhatsApp (mobile-first, anteprima link Open Graph curata); nessun costo oltre al dominio.

## Domande aperte

- **Stile grafico:** gli sposi non hanno ancora un'idea (nessuna partecipazione/palette). Hanno rifiutato il visual companion del brainstorming; preferiscono guardare template reali. Riferimenti già mandati:
  - Editoriale minimal: https://ceremony.framer.website/ , https://darling.framer.website/ (i domini `framer.website` sono bloccati dalla rete di casa: aprire da telefono)
  - Botanico/paesaggio: Zola Galata, Eastwick, Camden (`https://www.zola.com/wedding-planning/website/design/<nome>`)
  - Classico elegante: Zola Abbey, Verona (`.../design/abbey`, `.../design/verona-black`)
  - Romantico morbido: https://noahsabrinalove.framer.website/
  - Solo funzionamento RSVP a codice: https://wedding.rampatra.com (codice 271117)
- Orari di cerimonia e ricevimento; testi (FAQ, dress code); contatti da mostrare; IBAN e intestatario (andranno nel foglio, non qui).

## Prossimi passi (brainstorming)

1. Ricevere le preferenze di stile dagli sposi.
2. Proporre 2-3 approcci tecnici con raccomandazione (idea attuale: HTML/CSS/JS statico senza build, testi IT/EN in un file di traduzioni, script Python locale per ottimizzare le foto, Apps Script per RSVP).
3. Presentare il design a sezioni e farlo approvare.
4. Scrivere la spec (attenzione: tutto ciò che è nella repo è pubblico e servito da Pages; valutare `_config.yml` con `exclude`).
5. Piano di implementazione (skill `writing-plans`), poi codice.

## Ricerca utile

- Checklist contenuti: https://withjoy.com/blog/what-to-put-on-your-wedding-website-the-complete-checklist/
- Specifiche italiane (IBAN, allergie, mappe): https://www.matrimonio.com/articoli/sito-internet-di-matrimonio--c3266
- RSVP Apps Script + Sheet: https://github.com/nequals30/googleAppsScriptRSVP , https://github.com/LorenzoLabs/wedding-planner (link personale `?g=`, bilingue), https://github.com/rampatra/wedding-website
- Nota tecnica: per leggere la risposta dell'Apps Script dal sito evitare il preflight CORS (POST con body `text/plain` o form-urlencoded, niente header JSON); da verificare con un test reale.
