/*
 * Configurazione del sito. Qui NON vanno mai dati personali: la repo è pubblica.
 * IBAN, lista invitati e risposte vivono solo nel Google Sheet.
 */
window.SITE = {
  // URL della web app Google Apps Script (finisce con /exec).
  // Finché è vuoto l'RSVP resta chiuso; con ?invito=DEMO si vede un'anteprima che non salva nulla.
  rsvpApi: '',

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

  // Contatti: la sezione compare solo se c'è almeno un contatto.
  // Esempio: { name: 'Lucia', phone: '+39 333 0000000' }
  contacts: [],

  // Galleria: la sezione compare solo se c'è almeno una foto (da tools/optimize_photos.py).
  // Esempio: { src: 'photos/01.jpg', thumb: 'photos/thumbs/01.jpg', alt: { it: '...', en: '...' } }
  photos: []
};
