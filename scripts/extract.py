"""Extract vinyl catalog from PDF into structured JSON."""
import json
import re
import pdfplumber

PDF = '/Users/fabs/Downloads/catalogo-20260430 (1).pdf'
OUT = '/Users/fabs/Desktop/code/vinilos/data/vinilos.json'

HEADER_FIRST_CELL = 'Artista - Título'

def clean(s):
    if s is None:
        return ''
    return re.sub(r'\s+', ' ', s).strip()

def parse_title_field(raw):
    """Parse 'Artista - Título (Formato) (Sello - Catálogo)' field.

    The artist is everything up to the first ' - ', then comes the title
    which may contain parenthesized format and label info at the end.
    """
    raw = clean(raw)
    if not raw:
        return {'artista': '', 'titulo': '', 'sello': '', 'catalogo': '', 'formato_extra': ''}

    # split first " - " => artist | rest
    m = re.match(r'^(.*?)\s+-\s+(.*)$', raw)
    if not m:
        return {'artista': raw, 'titulo': '', 'sello': '', 'catalogo': '', 'formato_extra': ''}
    artista = m.group(1).strip()
    rest = m.group(2).strip()

    # extract trailing (...) groups from the end
    parens = []
    while True:
        m2 = re.search(r'\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$', rest)
        if not m2:
            break
        parens.insert(0, m2.group(1).strip())
        rest = rest[:m2.start()].rstrip()

    titulo = rest
    formato_extra = ''
    sello = ''
    catalogo = ''
    if len(parens) >= 1:
        # last paren is usually (sello - catálogo)
        last = parens[-1]
        if ' - ' in last or ' – ' in last:
            sep = ' – ' if ' – ' in last else ' - '
            parts = last.split(sep, 1)
            sello = parts[0].strip()
            catalogo = parts[1].strip() if len(parts) > 1 else ''
        else:
            sello = last
        if len(parens) >= 2:
            formato_extra = parens[-2]
        if len(parens) >= 3:
            # rare: extra info; concat into formato_extra
            formato_extra = ' / '.join(parens[:-1])

    return {
        'artista': artista,
        'titulo': titulo,
        'sello': sello,
        'catalogo': catalogo,
        'formato_extra': formato_extra,
    }


def extract_urls(text):
    if not text:
        return []
    return re.findall(r'https?://[^\s)]+', text)


def parse_price(p):
    if not p:
        return None
    m = re.search(r'(\d+(?:[\.,]\d+)?)', p.replace(',', '.'))
    if not m:
        return None
    try:
        return float(m.group(1))
    except ValueError:
        return None


def main():
    rows_out = []
    with pdfplumber.open(PDF) as pdf:
        for page_idx, page in enumerate(pdf.pages):
            tables = page.extract_tables()
            if not tables:
                continue
            for table in tables:
                for row in table:
                    if not row or len(row) < 9:
                        continue
                    first = clean(row[0])
                    if not first:
                        continue
                    if first.startswith('Catálogo Denki'):
                        continue
                    if first.startswith('Última actualización'):
                        continue
                    if first.startswith('Los nuevos títulos'):
                        continue
                    if first.startswith(HEADER_FIRST_CELL):
                        continue

                    parsed = parse_title_field(row[0])
                    formato = clean(row[1])
                    origen = clean(row[2])
                    anio = clean(row[3])
                    cond_disco = clean(row[4])
                    cond_portada = clean(row[5])
                    genero = clean(row[6])
                    notas = clean(row[7])
                    precio_raw = clean(row[8])

                    item = {
                        'id': len(rows_out) + 1,
                        'artista': parsed['artista'],
                        'titulo': parsed['titulo'],
                        'sello': parsed['sello'],
                        'catalogo': parsed['catalogo'],
                        'formato_extra': parsed['formato_extra'],
                        'formato': formato,
                        'origen': origen,
                        'anio': anio,
                        'condicion_disco': cond_disco,
                        'condicion_portada': cond_portada,
                        'genero': genero,
                        'notas': notas,
                        'urls': extract_urls(notas),
                        'precio': parse_price(precio_raw),
                        'precio_raw': precio_raw,
                        'pagina': page_idx + 1,
                    }
                    rows_out.append(item)

    import os
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, 'w', encoding='utf-8') as f:
        json.dump(rows_out, f, ensure_ascii=False, indent=2)

    print(f"Extracted {len(rows_out)} vinyls")
    print("Sample item:")
    print(json.dumps(rows_out[0], ensure_ascii=False, indent=2))
    print("\nLast item:")
    print(json.dumps(rows_out[-1], ensure_ascii=False, indent=2))

    # Stats
    formatos = {}
    generos = {}
    origenes = {}
    for r in rows_out:
        formatos[r['formato']] = formatos.get(r['formato'], 0) + 1
        generos[r['genero']] = generos.get(r['genero'], 0) + 1
        origenes[r['origen']] = origenes.get(r['origen'], 0) + 1
    print("\nFormatos:", sorted(formatos.items(), key=lambda x: -x[1])[:10])
    print("Top géneros:", sorted(generos.items(), key=lambda x: -x[1])[:10])
    print("Top orígenes:", sorted(origenes.items(), key=lambda x: -x[1])[:10])


if __name__ == '__main__':
    main()
