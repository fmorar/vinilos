import type { Vinilo } from "./types";
import { fetchRedRows } from "./sheetsColors";

const SHEET_ID = "1t4DmehFonmhXkQPLEc1HTL4SGelsHuw3s6FuUu4mN78";
const GID = "381745076";
const TSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=tsv&gid=${GID}`;

const REVALIDATE_SECONDS = 600;
const HEADER_FIRST = "Artista - Título";

function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  let i = 0;
  while (i < text.length) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      cell += c;
      i++;
      continue;
    }
    if (c === '"' && cell === "") {
      inQuotes = true;
      i++;
      continue;
    }
    if (c === "\t") {
      row.push(cell);
      cell = "";
      i++;
      continue;
    }
    if (c === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      i++;
      continue;
    }
    if (c === "\r") {
      i++;
      continue;
    }
    cell += c;
    i++;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function parsePrice(p: string): number | null {
  const m = p.match(/(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function parseOov(s: string): number | undefined {
  if (!s) return undefined;
  const n = parseFloat(s.replace(/,/g, ""));
  return Number.isFinite(n) ? n : undefined;
}

function extractUrls(notas: string): string[] {
  if (!notas) return [];
  return Array.from(notas.matchAll(/https?:\/\/[^\s)]+/g)).map((m) => m[0]);
}

function parseTitleField(raw: string) {
  const cleaned = raw.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return { artista: "", titulo: "", sello: "", catalogo: "", formato_extra: "" };
  }
  const m = cleaned.match(/^(.*?)\s+-\s+(.*)$/);
  if (!m) {
    return { artista: cleaned, titulo: "", sello: "", catalogo: "", formato_extra: "" };
  }
  const artista = m[1].trim();
  let rest = m[2].trim();

  const parens: string[] = [];
  while (true) {
    const m2 = rest.match(/\(([^()]*(?:\([^()]*\)[^()]*)*)\)\s*$/);
    if (!m2 || m2.index === undefined) break;
    parens.unshift(m2[1].trim());
    rest = rest.substring(0, m2.index).trimEnd();
  }

  const titulo = rest;
  let formato_extra = "";
  let sello = "";
  let catalogo = "";

  if (parens.length >= 1) {
    const last = parens[parens.length - 1];
    const sep = last.includes(" – ") ? " – " : last.includes(" - ") ? " - " : null;
    if (sep) {
      const parts = last.split(sep);
      sello = parts[0].trim();
      catalogo = parts.slice(1).join(sep).trim();
    } else {
      sello = last;
    }
    if (parens.length >= 2) {
      formato_extra = parens[parens.length - 2];
    }
    if (parens.length >= 3) {
      formato_extra = parens.slice(0, -1).join(" / ");
    }
  }

  return { artista, titulo, sello, catalogo, formato_extra };
}

export type FetchResult = {
  vinilos: Vinilo[];
  fetchedAt: string;
  source: "sheets" | "fallback";
};

export async function fetchVinilos(): Promise<FetchResult> {
  const [tsvRes, colorIndex] = await Promise.all([
    fetch(TSV_URL, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["vinilos"] },
    }),
    fetchRedRows(),
  ]);
  if (!tsvRes.ok) {
    throw new Error(`Sheets fetch failed with status ${tsvRes.status}`);
  }
  const text = await tsvRes.text();
  const rows = parseTsv(text);

  const vinilos: Vinilo[] = [];
  let headerSeen = false;
  let rowIndex = -1;

  for (const row of rows) {
    rowIndex++;
    if (!row.length || !row[0].trim()) continue;
    const first = row[0].trim();
    if (first.startsWith("Catálogo Denki")) continue;
    if (first.startsWith("Última actualización")) continue;
    if (first.startsWith("Los nuevos títulos")) continue;
    if (first.startsWith(HEADER_FIRST)) {
      headerSeen = true;
      continue;
    }
    if (!headerSeen) continue;
    if (row.length < 2) continue;

    const titleField = row[0] || "";
    const did = (row[1] || "").trim();
    const formato = (row[2] || "").trim();
    const origen = (row[3] || "").trim();
    const anio = (row[4] || "").trim();
    const cond_disco = (row[5] || "").trim();
    const cond_portada = (row[6] || "").trim();
    const genero = (row[7] || "").trim();
    const notas = (row[8] || "").trim();
    const precio_raw = (row[9] || "").trim();
    const estado = (row[10] || "").trim();
    const oov_raw = (row[11] || "").trim();
    const con = (row[12] || "").trim();

    if (estado.toUpperCase() !== "DISPONIBLE") continue;

    const parsed = parseTitleField(titleField);

    vinilos.push({
      id: vinilos.length + 1,
      did: did || undefined,
      artista: parsed.artista,
      titulo: parsed.titulo,
      sello: parsed.sello,
      catalogo: parsed.catalogo,
      formato_extra: parsed.formato_extra,
      formato,
      origen,
      anio,
      condicion_disco: cond_disco,
      condicion_portada: cond_portada,
      genero,
      notas,
      urls: extractUrls(notas),
      precio: parsePrice(precio_raw),
      precio_raw,
      pagina: 0,
      estado: estado || undefined,
      oov: parseOov(oov_raw),
      con: con || undefined,
      nuevo: colorIndex.redRows.has(rowIndex) || undefined,
    });
  }

  return {
    vinilos,
    fetchedAt: new Date().toISOString(),
    source: "sheets",
  };
}
