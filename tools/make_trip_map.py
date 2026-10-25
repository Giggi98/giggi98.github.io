"""Crea js/trip-map-data.js: i disegni della mappa del viaggio di nozze (Giappone in alto, Thailandia in basso).

Uso:
    python tools/make_trip_map.py ne_50m_admin_0_countries.geojson

Il file dei confini è "Natural Earth" (pubblico dominio), scaricabile da
https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson
Serve solo per rigenerare la mappa: non sta nella repo. Se cambiano le città o le zone mostrate, modifica CITIES/PANELS
qui sotto e rilancia lo script (poi controlla js/config.js e i testi `trip.*` in js/i18n.js).
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
WIDTH = 1000
GAP = 70

# Ogni riquadro mostra una zona (lon/lat) e i paesi da disegnare; l'altezza esce dalla scala.
PANELS = {
    'japan': {'lon': (134.2, 140.9), 'lat': (33.6, 36.8), 'countries': ['Japan']},
    'thailand': {'lon': (96.5, 106.0), 'lat': (7.4, 11.6),
                 'countries': ['Thailand', 'Cambodia', 'Malaysia', 'Myanmar', 'Vietnam', 'Laos']},
}

# id, riquadro, longitudine, latitudine (l'ordine è quello del viaggio)
CITIES = [
    ('tokyo', 'japan', 139.69, 35.69),
    ('kyoto', 'japan', 135.77, 35.01),
    ('osaka', 'japan', 135.50, 34.69),
    ('samui', 'thailand', 100.00, 9.50),
]


def rdp(points, eps):
    """Semplifica una linea togliendo i punti che deviano meno di eps (Ramer-Douglas-Peucker)."""
    if len(points) < 3:
        return points
    (x1, y1), (x2, y2) = points[0], points[-1]
    dx, dy = x2 - x1, y2 - y1
    norm = math.hypot(dx, dy) or 1e-9
    best, idx = 0, 0
    for i in range(1, len(points) - 1):
        x, y = points[i]
        d = abs(dy * x - dx * y + x2 * y1 - y2 * x1) / norm
        if d > best:
            best, idx = d, i
    if best <= eps:
        return [points[0], points[-1]]
    return rdp(points[:idx + 1], eps)[:-1] + rdp(points[idx:], eps)


def simplify_ring(points, eps):
    """Come rdp, ma per un contorno chiuso (primo punto = ultimo): lo si divide a metà nel punto più lontano dall'inizio."""
    if points[0] == points[-1]:
        points = points[:-1]
    far = max(range(len(points)), key=lambda i: math.hypot(points[i][0] - points[0][0], points[i][1] - points[0][1]))
    first = rdp(points[:far + 1], eps)
    second = rdp(points[far:] + [points[0]], eps)
    return first[:-1] + second[:-1]


def rings(geometry):
    if geometry['type'] == 'Polygon':
        polys = [geometry['coordinates']]
    else:
        polys = geometry['coordinates']
    for poly in polys:
        for ring in poly[:1]:      # solo il contorno esterno: niente laghi
            yield ring


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    data = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8'))
    by_name = {f['properties'].get('NAME') or f['properties'].get('name'): f for f in data['features']}

    out = {'width': WIDTH, 'panels': {}, 'cities': {}}
    y_offset = 0
    proj = {}
    for key, p in PANELS.items():
        (lon0, lon1), (lat0, lat1) = p['lon'], p['lat']
        k = math.cos(math.radians((lat0 + lat1) / 2))
        scale = WIDTH / ((lon1 - lon0) * k)
        height = round((lat1 - lat0) * scale)
        oy = y_offset

        def project(lon, lat, lon0=lon0, lat1=lat1, k=k, scale=scale, oy=oy):
            return ((lon - lon0) * k * scale, oy + (lat1 - lat) * scale)
        proj[key] = project

        parts = []
        for name in p['countries']:
            for ring in rings(by_name[name]['geometry']):
                pts = [project(lon, lat) for lon, lat in ring]
                xs, ys = [q[0] for q in pts], [q[1] for q in pts]
                # fuori dal riquadro o isolette minuscole: si saltano
                if max(xs) < -20 or min(xs) > WIDTH + 20 or max(ys) < oy - 20 or min(ys) > oy + height + 20:
                    continue
                if max(xs) - min(xs) < 4 and max(ys) - min(ys) < 4:
                    continue
                pts = simplify_ring(pts, 0.7)
                parts.append('M' + 'L'.join(f'{x:.1f} {y:.1f}' for x, y in pts) + 'Z')
        out['panels'][key] = {'y': oy, 'height': height, 'land': ''.join(parts)}
        y_offset += height + GAP

    out['height'] = y_offset - GAP
    for cid, panel, lon, lat in CITIES:
        x, y = proj[panel](lon, lat)
        out['cities'][cid] = {'x': round(x, 1), 'y': round(y, 1)}

    # tragitti: i primi due su terra (treno), l'ultimo in aereo con una curva verso il basso
    c = out['cities']
    def curve(a, b, bend):
        mx, my = (a['x'] + b['x']) / 2, (a['y'] + b['y']) / 2
        dx, dy = b['x'] - a['x'], b['y'] - a['y']
        n = math.hypot(dx, dy) or 1
        cx, cy = mx - dy / n * bend, my + dx / n * bend
        return f"M{a['x']} {a['y']}Q{cx:.1f} {cy:.1f} {b['x']} {b['y']}"
    out['routes'] = [
        {'type': 'train', 'd': curve(c['tokyo'], c['kyoto'], -30)},
        {'type': 'train', 'd': curve(c['kyoto'], c['osaka'], 8)},
        {'type': 'flight', 'd': curve(c['osaka'], c['samui'], 90)},
    ]

    target = ROOT / 'js' / 'trip-map-data.js'
    target.write_text(
        '/* Generato da tools/make_trip_map.py (confini: Natural Earth, pubblico dominio). Non modificare a mano. */\n'
        'window.TRIP_MAP = ' + json.dumps(out, separators=(',', ':')) + ';\n', encoding='utf-8')
    print(f'{target.relative_to(ROOT)}: {target.stat().st_size // 1024} KB, mappa {WIDTH}x{out["height"]}')


if __name__ == '__main__':
    main()
