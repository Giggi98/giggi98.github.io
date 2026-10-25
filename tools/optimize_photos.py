"""Prepara le foto per la galleria del sito.

Uso:
    python tools/optimize_photos.py CARTELLA_CON_LE_FOTO            (galleria)
    python tools/optimize_photos.py CARTELLA_CON_LE_FOTO --hero     (foto che scorrono nell'apertura)

Per ogni foto crea in photos/ una versione grande (lato lungo max 1600 px) e in photos/thumbs/ una miniatura
(480 px), poi stampa le righe da incollare in `photos` dentro js/config.js.
Le foto vengono ruotate secondo l'orientamento e ripulite da tutti i metadati (posizione GPS compresa):
il sito è pubblico, quindi non deve uscire nulla che non si veda nell'immagine.

Con --hero le foto vengono ritagliate in 3:2 (il formato della cornice), larghe 1200 px, e salvate in assets/hero/;
il ritaglio tiene il punto di fuoco un po' sopra il centro (--focus 0.4) così i visi restano dentro. Con --sheet FILE.jpg
crea anche un foglio di anteprima con tutte le foto, per controllare i ritagli.

Richiede Pillow (pip install pillow). Per le foto HEIC dell'iPhone serve anche: pip install pillow-heif
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

try:
    from pillow_heif import register_heif_opener
    register_heif_opener()
except ImportError:  # senza il plugin le foto HEIC vengono saltate con un messaggio
    pass

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
HERO_WIDTH = 1200
HERO_RATIO = 3 / 2
FULL_SIZE = 1600
THUMB_SIZE = 480


def save(img, path, size, quality):
    copy = img.copy()
    copy.thumbnail((size, size), Image.LANCZOS)
    copy.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)  # niente exif: non lo passiamo


def crop_hero(img, focus):
    """Ritaglia a 3:2 tenendo il punto di fuoco (0 = in alto, 1 = in basso) per le foto più alte del formato."""
    w, h = img.size
    if w / h > HERO_RATIO:                      # più larga: si tagliano i lati, al centro
        new_w = round(h * HERO_RATIO)
        left = (w - new_w) // 2
        box = (left, 0, left + new_w, h)
    else:                                       # più alta: si taglia sopra e sotto
        new_h = round(w / HERO_RATIO)
        top = round((h - new_h) * focus)
        box = (0, top, w, top + new_h)
    out = img.crop(box)
    return out.resize((HERO_WIDTH, round(HERO_WIDTH / HERO_RATIO)), Image.LANCZOS)


def contact_sheet(paths, target, cols=4, cell=300):
    rows = (len(paths) + cols - 1) // cols
    sheet = Image.new('RGB', (cols * cell, rows * round(cell / HERO_RATIO)), 'white')
    for i, p in enumerate(paths):
        with Image.open(p) as im:
            im = im.convert('RGB').resize((cell, round(cell / HERO_RATIO)), Image.LANCZOS)
        sheet.paste(im, ((i % cols) * cell, (i // cols) * round(cell / HERO_RATIO)))
    sheet.save(target, 'JPEG', quality=80)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path, help='cartella con le foto originali (anche sottocartelle)')
    parser.add_argument('--out', type=Path, help='cartella di destinazione (default: photos/, con --hero assets/hero/)')
    parser.add_argument('--hero', action='store_true', help="foto per l'apertura: ritagliate 3:2, in assets/hero/")
    parser.add_argument('--focus', type=float, default=0.4, help='con --hero: dove tenere il ritaglio nelle foto alte (0 alto, 1 basso)')
    parser.add_argument('--sheet', type=Path, help='con --hero: salva qui un foglio di anteprima dei ritagli')
    args = parser.parse_args()
    if args.out is None:
        args.out = ROOT / ('assets/hero' if args.hero else 'photos')

    files = sorted(p for p in args.source.rglob('*') if p.suffix.lower() in EXTENSIONS)
    if not files:
        sys.exit(f'Nessuna foto trovata in {args.source}')

    args.out.mkdir(parents=True, exist_ok=True)
    if not args.hero:
        (args.out / 'thumbs').mkdir(parents=True, exist_ok=True)
    entries = []
    for path in files:
        try:
            with Image.open(path) as raw:
                img = ImageOps.exif_transpose(raw).convert('RGB')
        except Exception as err:  # file rovinato o formato non supportato (es. HEIC senza plugin)
            print(f'Salto {path.name}: {err}', file=sys.stderr)
            continue
        name = f'{len(entries) + 1:02d}.jpg'
        if args.hero:
            crop_hero(img, args.focus).save(args.out / name, 'JPEG', quality=80, optimize=True, progressive=True)
            entries.append({'src': f'assets/hero/{name}'})
            print(f'{path.name} -> {name}', file=sys.stderr)
            continue
        save(img, args.out / name, FULL_SIZE, 82)
        save(img, args.out / 'thumbs' / name, THUMB_SIZE, 78)
        entries.append({'src': f'photos/{name}', 'thumb': f'photos/thumbs/{name}', 'alt': {'it': '', 'en': ''}})
        print(f'{path.name} -> {name}', file=sys.stderr)

    if args.hero:
        if args.sheet:
            contact_sheet([args.out / e['src'].split('/')[-1] for e in entries], args.sheet)
        print('\nIncolla in js/config.js (e metti la prima foto anche come src di .hero__photo in index.html):\n')
        print('  heroPhotos: ' + json.dumps(entries, ensure_ascii=False, indent=2).replace('\n', '\n  '))
        return
    print('\nIncolla in js/config.js (e scrivi una breve descrizione in alt, per chi usa lo screen reader):\n')
    print('  photos: ' + json.dumps(entries, ensure_ascii=False, indent=2).replace('\n', '\n  '))


if __name__ == '__main__':
    main()
