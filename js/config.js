/*
 * Configurazione del sito. Qui NON vanno mai dati personali: la repo è pubblica.
 * IBAN, lista invitati e risposte vivono solo nel Google Sheet.
 */
window.SITE = {
  // URL della web app Google Apps Script (finisce con /exec).
  // Finché è vuoto l'RSVP resta chiuso; con ?invito=DEMO si vede un'anteprima che non salva nulla.
  rsvpApi: 'https://script.google.com/macros/s/AKfycbx22OZhNEr05OxGnSBPShT9RlgFky9mV1cbP9IC4k6xMBn03CaWsetJ7bflnE0g6wX9CA/exec',

  // 29 maggio 2027, cerimonia alle 11:00 (ora italiana, UTC+2 a maggio)
  date: '2027-05-29',
  ceremonyTime: '11:00',
  ceremonyStartUtc: '2027-05-29T09:00:00Z',

  ceremony: {
    lat: 45.7449407,
    lng: 9.7612093,
    mapsQuery: 'Chiesa di Santa Maria Assunta in Borgo, Via Giuseppe Mazzini 51, 24027 Nembro BG'
  },
  reception: {
    lat: 45.7583456,
    lng: 9.9184287,
    mapsQuery: 'Castello di Monasterolo, Piazzetta Contessa V. Terni de Gregori 1, 24060 Monasterolo del Castello BG',
    // Orario ancora da comunicare: scrivilo qui (es. '13:00') e comparirà nel programma.
    time: ''
  },

  // Regalo di nozze: segnaposto, da sostituire con l'IBAN vero.
  // Attenzione: la repo è pubblica, quello che scrivi qui lo vede chiunque. Se vuoi che l'IBAN lo vedano
  // solo gli invitati con il link personale, lascia qui il segnaposto e mettilo nel foglio Google (foglio Config).
  gift: { holder: 'Luigi Cagliani', iban: 'XXXXXXXXXXXXXXXXXXXXXXXXXXX' },

  // Foto che scorrono nell'apertura (da `python tools/optimize_photos.py CARTELLA --hero`).
  // Se sono meno di due resta ferma la prima (o quella già nell'HTML).
  // Esempio: { src: 'assets/hero/01.jpg' }
  heroPhotos: [
    { src: 'assets/hero/01.jpg' },
    { src: 'assets/hero/02.jpg' },
    { src: 'assets/hero/03.jpg' },
    { src: 'assets/hero/04.jpg' },
    { src: 'assets/hero/05.jpg' },
    { src: 'assets/hero/06.jpg' },
    { src: 'assets/hero/07.jpg' },
    { src: 'assets/hero/08.jpg' },
    { src: 'assets/hero/09.jpg' },
    { src: 'assets/hero/10.jpg' },
    { src: 'assets/hero/11.jpg' },
    { src: 'assets/hero/12.jpg' },
    { src: 'assets/hero/13.jpg' },
    { src: 'assets/hero/14.jpg' },
    { src: 'assets/hero/15.jpg' }
  ],

  // Contatti: la sezione compare solo se c'è almeno un contatto.
  // Esempio: { name: 'Lucia', phone: '+39 333 0000000' }
  contacts: [],

  // Galleria: la sezione compare solo se c'è almeno una foto (da tools/optimize_photos.py).
  // Esempio: { src: 'photos/01.jpg', thumb: 'photos/thumbs/01.jpg', alt: { it: '...', en: '...' } }
  photos: []
};
