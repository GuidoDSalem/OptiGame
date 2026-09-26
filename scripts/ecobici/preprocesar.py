"""
Preprocesamiento de los datos de Ecobici para el caso de estudio C2.

Lee los recorridos crudos (cientos de MB, NO van al repo) y genera un resumen compacto:
src/casos/bicis/datos.json.

Fuentes (datos abiertos):
  - Recorridos realizados 2023 y 2024, Buenos Aires Data (Gobierno de la Ciudad):
    https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/bicicletas-publicas/recorridos-realizados-2023.zip
    https://cdn.buenosaires.gob.ar/datosabiertos/datasets/transporte-y-obras-publicas/bicicletas-publicas/recorridos-realizados-2024.zip
  - Lluvia y temperatura diarias (reanálisis ERA5), Open-Meteo:
    https://archive-api.open-meteo.com/v1/archive?latitude=-34.6037&longitude=-58.3816&start_date=2023-01-01&end_date=2024-12-31&daily=precipitation_sum,temperature_2m_max&timezone=America%2FArgentina%2FBuenos_Aires

Uso:
  python3 scripts/ecobici/preprocesar.py <trips_2023.csv> <trips_2024.csv> <clima.json>
"""
import base64
import collections
import csv
import datetime as dt
import json
import sys

# Zona del caso: el Centro (Constitución, Retiro, Microcentro, Puerto Madero).
CAJA = {'lat': (-34.632, -34.588), 'lon': (-58.395, -58.355)}
N_ESTACIONES = 30
HORAS = list(range(6, 24))  # de 6 a 24 h, en bloques de una hora
SALIDA = 'src/casos/bicis/datos.json'


def sid(x):
    return (x or '').replace('BAEcobici', '').strip()


def leer(path):
    with open(path, encoding='utf-8-sig', newline='') as f:
        yield from csv.DictReader(f)


def hora(s):
    # "2023-04-24 10:30:10" -> (fecha, hora, minuto)
    return s[:10], int(s[11:13]), int(s[14:16])


def main(p23, p24, pclima):
    # 1) Estaciones y volumen por año.
    info = {}
    vol = collections.Counter()
    for path, anio in ((p23, 2023), (p24, 2024)):
        for r in leer(path):
            for lado in ('origen', 'destino'):
                s = sid(r[f'id_estacion_{lado}'])
                if not s:
                    continue
                vol[(anio, s)] += 1
                if s not in info:
                    try:
                        info[s] = (r[f'nombre_estacion_{lado}'], float(r[f'lat_estacion_{lado}']), float(r[f'long_estacion_{lado}']))
                    except ValueError:
                        pass

    def en_caja(s):
        _, lat, lon = info[s]
        return CAJA['lat'][0] <= lat <= CAJA['lat'][1] and CAJA['lon'][0] <= lon <= CAJA['lon'][1]

    candidatas = [s for s in info if en_caja(s) and vol[(2023, s)] > 2000 and vol[(2024, s)] > 2000]
    candidatas.sort(key=lambda s: -(vol[(2023, s)] + vol[(2024, s)]))
    elegidas = candidatas[:N_ESTACIONES]
    idx = {s: i for i, s in enumerate(elegidas)}

    # 2) Salidas y llegadas por estación, día y hora (sólo días hábiles), y viajes de todo el sistema por día.
    H = len(HORAS)
    cuentas = collections.defaultdict(lambda: [0] * (N_ESTACIONES * H * 2))
    sistema = collections.Counter()
    zona = collections.Counter()
    viajes_dia = collections.defaultdict(list)  # para animar algunos días reales
    for path in (p23, p24):
        for r in leer(path):
            try:
                fo, ho, mo = hora(r['fecha_origen_recorrido'])
                fd, hd, md = hora(r['fecha_destino_recorrido'])
            except (ValueError, IndexError):
                continue
            sistema[fo] += 1
            o, d = idx.get(sid(r['id_estacion_origen'])), idx.get(sid(r['id_estacion_destino']))
            if o is None and d is None:
                continue
            zona[fo] += 1
            if o is not None and ho in HORAS:
                cuentas[fo][(o * H + HORAS.index(ho)) * 2] += 1
            if d is not None and fd == fo and hd in HORAS:
                cuentas[fo][(d * H + HORAS.index(hd)) * 2 + 1] += 1
            # Para animar: índices de estación (-1 = fuera de la zona) y, si está afuera, sus coordenadas.
            def coord(lado, i):
                if i is not None:
                    return 0, 0
                try:
                    return round(float(r[f'lat_estacion_{lado}']), 4), round(float(r[f'long_estacion_{lado}']), 4)
                except ValueError:
                    return 0, 0
            viajes_dia[fo].append((-1 if o is None else o, -1 if d is None else d, ho * 60 + mo, hd * 60 + md, *coord('origen', o), *coord('destino', d)))

    clima = json.load(open(pclima))['daily']
    lluvia = dict(zip(clima['time'], clima['precipitation_sum']))
    tmax = dict(zip(clima['time'], clima['temperature_2m_max']))

    dias = []
    for fecha in sorted(cuentas):
        f = dt.date.fromisoformat(fecha)
        if f.year not in (2023, 2024) or f.weekday() >= 5:
            continue
        c = bytes(min(255, v) for v in cuentas[fecha])
        dias.append({
            'f': fecha,
            'ds': f.weekday(),
            'll': round(lluvia.get(fecha) or 0, 1),
            't': round(tmax.get(fecha) or 0, 1),
            'sis': sistema[fecha],
            'zona': zona[fecha],
            'c': base64.b64encode(c).decode(),
        })

    # 3) Dos días reales para animar: uno típico sin lluvia y uno con mucha lluvia (ambos de 2023).
    habiles23 = [d for d in dias if d['f'].startswith('2023')]
    # Día típico: sin lluvia, fuera de vacaciones (abril a noviembre), con el volumen mediano.
    secos = sorted([d for d in habiles23 if d['ll'] < 0.2 and '04' <= d['f'][5:7] <= '11'], key=lambda d: d['zona'])
    tipico = secos[len(secos) // 2]['f']
    lluvioso = max(habiles23, key=lambda d: d['ll'])['f']
    # Sólo la mañana (6 a 12 h), que es la ventana del caso.
    animados = {f: sorted((v for v in viajes_dia[f] if 360 <= v[2] < 720), key=lambda v: v[2]) for f in (tipico, lluvioso)}

    salida = {
        'fuente': {
            'recorridos': 'Recorridos realizados 2023 y 2024 · Buenos Aires Data, Gobierno de la Ciudad de Buenos Aires',
            'clima': 'Lluvia y temperatura diarias estimadas (reanálisis ERA5) · Open-Meteo',
        },
        'horas': HORAS,
        'estaciones': [
            {'id': s, 'nombre': info[s][0], 'lat': info[s][1], 'lon': info[s][2], 'viajes2023': vol[(2023, s)], 'viajes2024': vol[(2024, s)]}
            for s in elegidas
        ],
        'dias': dias,
        'animados': animados,
    }
    with open(SALIDA, 'w', encoding='utf-8') as f:
        json.dump(salida, f, ensure_ascii=False, separators=(',', ':'))
    # Las estaciones solas (chico): lo usa la miniatura del menú sin cargar todos los datos.
    with open(SALIDA.replace('datos.json', 'estaciones.json'), 'w', encoding='utf-8') as f:
        json.dump(salida['estaciones'], f, ensure_ascii=False, separators=(',', ':'))
    print(f'{len(elegidas)} estaciones, {len(dias)} días hábiles, típico {tipico}, lluvioso {lluvioso} -> {SALIDA}')


if __name__ == '__main__':
    main(*sys.argv[1:4])
