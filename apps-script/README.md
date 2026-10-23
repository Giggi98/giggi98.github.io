# Backend RSVP: Google Sheet + Apps Script

Il sito non ha un server: le risposte degli invitati arrivano a un Google Sheet tramite questo script.
Il foglio è anche la vostra lista invitati. Si scarica in Excel quando volete (File > Scarica > Microsoft Excel).

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
   - `intestatario`, `iban`, `causale`: per la lista nozze. L'IBAN compare sul sito solo a chi apre un invito con un codice valido.
7. **Compila `Invitati`:** una riga per persona. Compila `Invito` (come volete salutarli, es. "Famiglia Rossi"), `Lingua` (`it` o `en`),
   `Nome`, e scrivi `Sì` in `Bambino` per i bambini (serve al conteggio dei menù bimbi).
   Tutte le persone dello stesso invito devono avere **lo stesso testo** in `Invito`: così condividono un unico link.
   Le colonne `ID`, `Codice` e `Link` le riempie lo script. `Risposta`, `Dieta`, `Allergie`, `Aggiornato` le riempie il sito.
   Cancella le tre righe "Famiglia Esempio".
8. **Genera i link.** Menu Matrimonio > "2. Genera codici e link". Nell'ultima colonna trovi il link personale di ogni invito.
   Puoi rieseguirlo ogni volta che aggiungi invitati: i codici già assegnati non cambiano.
9. **Pubblica lo script come web app.** Nell'editor: Distribuisci > Nuova distribuzione > ingranaggio > App web.
   - Esegui come: **Me**
   - Chi ha accesso: **Chiunque**
   - Distribuisci e copia l'URL che finisce con `/exec`.
   "Chiunque" serve perché gli invitati non hanno un account Google. I dati restano nel foglio, che è privato: dallo script esce
   solo l'invito di chi presenta un codice valido.
10. **Collega il sito.** Incolla l'URL in `rsvpApi` dentro [js/config.js](../js/config.js), poi fai commit e push.
    Apri un link personale e fai una risposta di prova. Poi cancella dal foglio i dati di prova (colonne `Risposta`...`Aggiornato` della riga, e la riga in `Messaggi`).

## Se modifichi lo script dopo la pubblicazione

Distribuisci > Gestisci distribuzioni > matita > Versione: "Nuova versione" > Distribuisci. L'URL resta lo stesso.
Se invece crei una "Nuova distribuzione" l'URL cambia e va aggiornato in `js/config.js`.

## Cosa vedi nel foglio

| Foglio | Contenuto |
| --- | --- |
| `Invitati` | una riga per persona: risposta (Sì/No), dieta, allergie, data dell'ultimo aggiornamento, link personale |
| `Messaggi` | il messaggio per gli sposi, uno per invito |
| `Riepilogo` | confermati, non vengono, senza risposta, menù bimbi, vegetariani, vegani, allergie |
| `Config` | scadenza, email di notifica, IBAN |

Puoi ordinare e filtrare `Invitati` come vuoi: lo script riconosce le persone dal loro `ID`, non dalla posizione.
Non cambiare il nome dei fogli né l'ordine delle colonne.

## Privacy

- La repo GitHub è pubblica: in questa cartella c'è solo il codice, nessun dato. Non incollare mai nella repo IBAN, codici o liste.
- Il codice invito è di 6 caratteri su 32 possibili (circa un miliardo di combinazioni): non si indovina a tentativi.
- Chi ha il link di un invito può vedere e cambiare le risposte di quell'invito. Per questo il link va mandato solo a chi è invitato.

## Collaudo in locale (per chi modifica lo script)

`node apps-script/test.js` esegue `Code.gs` contro un finto foglio di calcolo e controlla codici, lettura dell'invito, salvataggio,
scadenza, validazione e notifiche. Non sostituisce una prova reale dopo la pubblicazione.
