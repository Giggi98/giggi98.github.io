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
  photos: [
    { src: 'photos/01.jpg', thumb: 'photos/thumbs/01.jpg' },
    { src: 'photos/02.jpg', thumb: 'photos/thumbs/02.jpg' },
    { src: 'photos/03.jpg', thumb: 'photos/thumbs/03.jpg' },
    { src: 'photos/04.jpg', thumb: 'photos/thumbs/04.jpg' },
    { src: 'photos/05.jpg', thumb: 'photos/thumbs/05.jpg' },
    { src: 'photos/06.jpg', thumb: 'photos/thumbs/06.jpg' },
    { src: 'photos/07.jpg', thumb: 'photos/thumbs/07.jpg' },
    { src: 'photos/08.jpg', thumb: 'photos/thumbs/08.jpg' },
    { src: 'photos/09.jpg', thumb: 'photos/thumbs/09.jpg' },
    { src: 'photos/10.jpg', thumb: 'photos/thumbs/10.jpg' },
    { src: 'photos/11.jpg', thumb: 'photos/thumbs/11.jpg' },
    { src: 'photos/12.jpg', thumb: 'photos/thumbs/12.jpg' },
    { src: 'photos/13.jpg', thumb: 'photos/thumbs/13.jpg' },
    { src: 'photos/14.jpg', thumb: 'photos/thumbs/14.jpg' },
    { src: 'photos/15.jpg', thumb: 'photos/thumbs/15.jpg' },
    { src: 'photos/16.jpg', thumb: 'photos/thumbs/16.jpg' },
    { src: 'photos/17.jpg', thumb: 'photos/thumbs/17.jpg' },
    { src: 'photos/18.jpg', thumb: 'photos/thumbs/18.jpg' },
    { src: 'photos/19.jpg', thumb: 'photos/thumbs/19.jpg' },
    { src: 'photos/20.jpg', thumb: 'photos/thumbs/20.jpg' },
    { src: 'photos/21.jpg', thumb: 'photos/thumbs/21.jpg' },
    { src: 'photos/22.jpg', thumb: 'photos/thumbs/22.jpg' },
    { src: 'photos/23.jpg', thumb: 'photos/thumbs/23.jpg' },
    { src: 'photos/24.jpg', thumb: 'photos/thumbs/24.jpg' },
    { src: 'photos/25.jpg', thumb: 'photos/thumbs/25.jpg' },
    { src: 'photos/26.jpg', thumb: 'photos/thumbs/26.jpg' },
    { src: 'photos/27.jpg', thumb: 'photos/thumbs/27.jpg' },
    { src: 'photos/28.jpg', thumb: 'photos/thumbs/28.jpg' },
    { src: 'photos/29.jpg', thumb: 'photos/thumbs/29.jpg' },
    { src: 'photos/30.jpg', thumb: 'photos/thumbs/30.jpg' },
    { src: 'photos/31.jpg', thumb: 'photos/thumbs/31.jpg' },
    { src: 'photos/32.jpg', thumb: 'photos/thumbs/32.jpg' },
    { src: 'photos/33.jpg', thumb: 'photos/thumbs/33.jpg' },
    { src: 'photos/34.jpg', thumb: 'photos/thumbs/34.jpg' },
    { src: 'photos/35.jpg', thumb: 'photos/thumbs/35.jpg' },
    { src: 'photos/36.jpg', thumb: 'photos/thumbs/36.jpg' },
    { src: 'photos/37.jpg', thumb: 'photos/thumbs/37.jpg' },
    { src: 'photos/38.jpg', thumb: 'photos/thumbs/38.jpg' },
    { src: 'photos/39.jpg', thumb: 'photos/thumbs/39.jpg' },
    { src: 'photos/40.jpg', thumb: 'photos/thumbs/40.jpg' },
    { src: 'photos/41.jpg', thumb: 'photos/thumbs/41.jpg' },
    { src: 'photos/42.jpg', thumb: 'photos/thumbs/42.jpg' },
    { src: 'photos/43.jpg', thumb: 'photos/thumbs/43.jpg' },
    { src: 'photos/44.jpg', thumb: 'photos/thumbs/44.jpg' },
    { src: 'photos/45.jpg', thumb: 'photos/thumbs/45.jpg' },
    { src: 'photos/46.jpg', thumb: 'photos/thumbs/46.jpg' },
    { src: 'photos/47.jpg', thumb: 'photos/thumbs/47.jpg' },
    { src: 'photos/48.jpg', thumb: 'photos/thumbs/48.jpg' },
    { src: 'photos/49.jpg', thumb: 'photos/thumbs/49.jpg' },
    { src: 'photos/50.jpg', thumb: 'photos/thumbs/50.jpg' },
    { src: 'photos/51.jpg', thumb: 'photos/thumbs/51.jpg' },
    { src: 'photos/52.jpg', thumb: 'photos/thumbs/52.jpg' },
    { src: 'photos/53.jpg', thumb: 'photos/thumbs/53.jpg' },
    { src: 'photos/54.jpg', thumb: 'photos/thumbs/54.jpg' },
    { src: 'photos/55.jpg', thumb: 'photos/thumbs/55.jpg' },
    { src: 'photos/56.jpg', thumb: 'photos/thumbs/56.jpg' },
    { src: 'photos/57.jpg', thumb: 'photos/thumbs/57.jpg' },
    { src: 'photos/58.jpg', thumb: 'photos/thumbs/58.jpg' }
  ]
};
