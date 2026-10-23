"""Prepara le foto per la galleria del sito.

Uso:
    python tools/optimize_photos.py CARTELLA_CON_LE_FOTO

Per ogni foto crea in photos/ una versione grande (lato lungo max 1600 px) e in photos/thumbs/ una miniatura
(480 px), poi stampa le righe da incollare in `photos` dentro js/config.js.
Le foto vengono ruotate secondo l'orientamento e ripulite da tutti i metadati (posizione GPS compresa):
il sito è pubblico, quindi non deve uscire nulla che non si veda nell'immagine.

Richiede Pillow: pip install pillow
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageOps

ROOT = Path(__file__).resolve().parent.parent
EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic'}
FULL_SIZE = 1600
THUMB_SIZE = 480


def save(img, path, size, quality):
    copy = img.copy()
    copy.thumbnail((size, size), Image.LANCZOS)
    copy.save(path, 'JPEG', quality=quality, optimize=True, progressive=True)  # niente exif: non lo passiamo


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('source', type=Path, help='cartella con le foto originali (anche sottocartelle)')
    parser.add_argument('--out', type=Path, default=ROOT / 'photos', help='cartella di destinazione (default: photos/)')
    args = parser.parse_args()

    files = sorted(p for p in args.source.rglob('*') if p.suffix.lower() in EXTENSIONS)
    if not files:
        sys.exit(f'Nessuna foto trovata in {args.source}')

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
        save(img, args.out / name, FULL_SIZE, 82)
        save(img, args.out / 'thumbs' / name, THUMB_SIZE, 78)
        entries.append({'src': f'photos/{name}', 'thumb': f'photos/thumbs/{name}', 'alt': {'it': '', 'en': ''}})
        print(f'{path.name} -> {name}', file=sys.stderr)

    print('\nIncolla in js/config.js (e scrivi una breve descrizione in alt, per chi usa lo screen reader):\n')
    print('  photos: ' + json.dumps(entries, ensure_ascii=False, indent=2).replace('\n', '\n  '))


if __name__ == '__main__':
    main()
