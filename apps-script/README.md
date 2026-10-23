# Backend RSVP: Google Sheet + Apps Script

Il sito non ha un server: le risposte degli invitati arrivano a un Google Sheet tramite questo script.
Tutti ricevono lo stesso link del sito: ognuno scrive il proprio nome nel modulo, aggiunge chi viene con lui, e lo script
aggiunge le righe al foglio `Invitati`. Chi vuole cambiare la risposta riapre il sito dallo stesso telefono e preme RSVP: la ritrova già compilata (il sito la ricorda nel browser). Il foglio si scarica in Excel quando volete (File > Scarica > Microsoft Excel).

## Installazione (circa 15 minuti, una volta sola)

1. **Crea il foglio.** Su [sheets.google.com](https://sheets.google.com) crea un foglio vuoto, per esempio "Matrimonio - Invitati".
   In File > Impostazioni scegli Italia come impostazione internazionale e `(GMT+01:00) Roma` come fuso orario.
2. **Apri l'editor dello script.** Nel foglio: Estensioni > Apps Script.
3. **Incolla il codice.** Cancella il contenuto di `Code.gs` e incolla quello del file [Code.gs](Code.gs) di questa cartella.
4. **Imposta il fuso orario dello script.** Impostazioni progetto (ingranaggio) > spunta "Mostra il file manifest appsscript.json",
   poi apri `appsscript.json` e sostituiscilo con il contenuto di [appsscript.json](appsscript.json). Salva.
5. **Prepara i fogli.** Ricarica la pagina del foglio: compare il menu **Matrimonio**. Scegli "1. Prepara i fogli".
   La prima volta Google chiede di autorizzare lo script: è normale (è il vostro script, sul vostro foglio).
   Se compare "Google non ha verificato questa app": Avanzate > Vai a (nome progetto) > Consenti.
6. **Compila `Config`:**
   - `scadenza_rsvp`: ultimo giorno per rispondere o modificare (formato `2027-04-30`).
   - `email_notifica`: la mail che riceve un avviso a ogni risposta (lasciala vuota per non riceverne). `notifica_attiva`: `SI` o `NO`.
   - `intestatario`, `iban`, `causale`: per il regalo di nozze. Compaiono nella sezione "Regalo di nozze" del sito, visibili a chi lo apre.
7. **`Invitati` si riempie da solo.** Ogni risposta aggiunge una riga per persona: `Invito` è il nome di chi ha risposto, `Lingua` quella
   del sito al momento dell'invio, `Bambino` è `Sì` se l'invitato ha spuntato la casella. `ID`, `Codice` e `Link` li scrive lo script (il link non viene mostrato agli invitati: serve solo a voi).
   Cancella le tre righe "Famiglia Esempio" create da "Prepara i fogli". Se vuoi puoi anche scrivere tu degli invitati e dare loro un link
   personale con il menu Matrimonio > "2. Genera codici e link" (opzionale: non serve per il link unico).
8. **Pubblica lo script come web app.** Nell'editor: Distribuisci > Nuova distribuzione > ingranaggio > App web.
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
   - Distribuisci e copia l'URL che finisce con `/exec`.
   "Chiunque" serve perché gli invitati non hanno un account Google. I dati restano nel foglio, che è privato: dallo script esce
   solo la risposta di chi presenta il suo codice (e scadenza e IBAN, che sono pubblici).
9. **Collega il sito.** Incolla l'URL in `rsvpApi` dentro [js/config.js](../js/config.js), poi fai commit e push.
    Apri il sito, fai una risposta di prova e controlla che arrivi nel foglio. Poi cancella dal foglio i dati di prova (colonne `Risposta`...`Aggiornato` della riga, e la riga in `Messaggi`).

## Se modifichi lo script dopo la pubblicazione

Incolla il nuovo `Code.gs` nell'editor, salva, poi Distribuisci > Gestisci distribuzioni > matita > Versione: "Nuova versione" > Distribuisci. L'URL resta lo stesso.
Se la risposta del sito non cambia, il deploy non è stato aggiornato: il sito parla sempre con l'ultima versione *distribuita*, non con quella nell'editor.
Se invece crei una "Nuova distribuzione" l'URL cambia e va aggiornato in `js/config.js`.

## Cosa vedi nel foglio

| Foglio | Contenuto |
| --- | --- |
| `Invitati` | una riga per persona: nome, bambino, risposta (Sì/No), dieta, allergie, data dell'ultimo aggiornamento, link per modificare |
| `Messaggi` | il messaggio per gli sposi, uno per invito |
| `Riepilogo` | confermati, non vengono, senza risposta, menù bimbi, vegetariani, vegani, allergie |
| `Config` | scadenza, email di notifica, IBAN |
| `Controlli` | rapporto di duplicati ed errori (si crea dal menu Matrimonio > "3. Controlla duplicati ed errori") |

Puoi ordinare e filtrare `Invitati` come vuoi: lo script riconosce le persone dal loro `ID`, non dalla posizione.
Non cambiare il nome dei fogli né l'ordine delle colonne.

## Controlli su duplicati ed errori

- In `Invitati` i **nomi doppi** si colorano di rosso da soli (maiuscole e minuscole non contano).
- Menu Matrimonio > "3. Controlla duplicati ed errori" crea il foglio `Controlli` con: nomi doppi o ripetuti nello stesso invito, stessi nomi in ordine
  diverso ("Bianchi Mario" / "Mario Bianchi"), nomi quasi uguali (un refuso), righe senza nome, codici condivisi da inviti diversi e bambini
  che vengono senza nessun adulto del loro invito. Per ogni problema indica le righe di `Invitati`. Rilancialo quando vuoi: riscrive il foglio.
- Per ogni nome doppio il rapporto mostra le righe con invito, data e risposta e indica la più recente: di solito è quella valida, la vecchia si cancella.
- Il foglio `Riepilogo` ha la riga "Righe con nome doppio (controlla)": finché non è 0 i conteggi (confermati, menù bimbi...) contano due volte qualcuno.
- Il controllo non cancella né unisce nulla: decidete voi cosa fare con le righe segnalate.

## Privacy

- La repo GitHub è pubblica: in questa cartella c'è solo il codice, nessun dato. Non incollare mai nella repo IBAN, codici o liste.
- Chiunque abbia il link del sito può mandare una risposta. Per limitare gli abusi: un campo nascosto che i bot compilano (e che fa scartare l'invio),
  massimo 12 persone per risposta e massimo 600 righe in `Invitati`. Controlla ogni tanto il foglio e togli a mano le righe che non riconosci.
- Ogni risposta ha un codice di 6 caratteri (circa un miliardo di combinazioni) che il sito tiene nel browser dell'invitato: non si indovina a tentativi.
  Chi risponde da un altro telefono o browser non ritrova la risposta e ne crea una nuova: i doppioni si risolvono nel foglio (vedi sotto).
- Scadenza, stato aperto/chiuso e IBAN sono pubblici (li legge chiunque apra il sito). I nomi e le risposte degli invitati no.

## Collaudo in locale (per chi modifica lo script)

`node apps-script/test.js` esegue `Code.gs` contro un finto foglio di calcolo e controlla codici, lettura dell'invito, salvataggio,
creazione e modifica delle risposte, scadenza, validazione, antispam e notifiche. Non sostituisce una prova reale dopo la pubblicazione.
