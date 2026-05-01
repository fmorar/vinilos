"""Merge Discogs IDs (DIDs) and extra fields from a TSV catalog into vinilos.json.

Expected TSV format (tab-separated, with header on first non-empty line):

  Artista - Título (Formato) (Sello - Catálogo)\\tDID\\tFormato\\tOrigen\\tAño\\tCondición disco\\tCondición portada\\tGénero\\tObservaciones y notas\\tPrecio\\tEstado\\tOOV\\tCON

Usage:
  python3 scripts/merge_dids.py [path-to-tsv]

If no path is given, defaults to data/catalogo.tsv.
"""
import csv
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
JSON_PATH = ROOT / "data" / "vinilos.json"
APP_JSON_PATH = ROOT / "app" / "src" / "data" / "vinilos.json"
TSV_PATH = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / "data" / "catalogo.tsv"

HEADER_FIRST_CELL = "Artista - Título"


def normalize_key(s: str) -> str:
    """Lowercase and collapse whitespace; keep punctuation."""
    return re.sub(r"\s+", " ", s).strip().lower()


def main():
    if not TSV_PATH.exists():
        print(f"ERROR: TSV not found at {TSV_PATH}")
        print()
        print("Save your catalog TSV first. From the spreadsheet, copy all rows")
        print("(including the header) and run on macOS:")
        print(f"  pbpaste > {TSV_PATH}")
        sys.exit(1)

    if not JSON_PATH.exists():
        print(f"ERROR: JSON not found at {JSON_PATH}. Run scripts/extract.py first.")
        sys.exit(1)

    with open(JSON_PATH, encoding="utf-8") as f:
        vinilos = json.load(f)

    by_full = {}
    for v in vinilos:
        full = f"{v['artista']} - {v['titulo']}"
        by_full[normalize_key(full)] = v

    matched = 0
    unmatched = 0
    no_did = 0
    sample_unmatched = []

    with open(TSV_PATH, encoding="utf-8", newline="") as f:
        reader = csv.reader(f, delimiter="\t", quoting=csv.QUOTE_MINIMAL)
        header_seen = False
        for row in reader:
            if not row or not row[0].strip():
                continue
            first = row[0].strip()
            if first.startswith(HEADER_FIRST_CELL):
                header_seen = True
                continue
            if not header_seen:
                continue
            if len(row) < 2:
                continue

            full_field = row[0].strip()
            did = row[1].strip() if len(row) > 1 else ""
            estado = row[10].strip() if len(row) > 10 else ""
            oov_raw = row[11].strip() if len(row) > 11 else ""
            con = row[12].strip() if len(row) > 12 else ""

            artista_titulo = re.sub(r"\s*\([^)]*\)\s*$", "", full_field)
            while re.search(r"\([^)]*\)\s*$", artista_titulo):
                artista_titulo = re.sub(r"\s*\([^)]*\)\s*$", "", artista_titulo)
            key = normalize_key(artista_titulo)

            target = by_full.get(key)
            if not target:
                full_no_parens = re.sub(r"\s*\([^)]*\)", "", full_field).strip()
                target = by_full.get(normalize_key(full_no_parens))

            if not target:
                unmatched += 1
                if len(sample_unmatched) < 10:
                    sample_unmatched.append(full_field[:100])
                continue

            matched += 1
            if did:
                target["did"] = did
            else:
                no_did += 1
            if estado:
                target["estado"] = estado
            if con:
                target["con"] = con
            try:
                if oov_raw:
                    target["oov"] = float(oov_raw.replace(",", ""))
            except ValueError:
                pass

    with open(JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(vinilos, f, ensure_ascii=False, indent=2)

    APP_JSON_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(APP_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(vinilos, f, ensure_ascii=False, indent=2)

    with_did = sum(1 for v in vinilos if v.get("did"))
    print(f"Matched: {matched}")
    print(f"Without DID in source: {no_did}")
    print(f"Unmatched rows: {unmatched}")
    print(f"Entries now with DID: {with_did} / {len(vinilos)}")
    if sample_unmatched:
        print("\nSample unmatched (first 10):")
        for u in sample_unmatched:
            print(f"  - {u}")


if __name__ == "__main__":
    main()
