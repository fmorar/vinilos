const SHEET_ID = "1t4DmehFonmhXkQPLEc1HTL4SGelsHuw3s6FuUu4mN78";
const SHEET_NAME = "Catálogo Denki Records";
const REVALIDATE_SECONDS = 600;

type RgbColor = { red?: number; green?: number; blue?: number };
type ApiResponse = {
  sheets?: Array<{
    data?: Array<{
      rowData?: Array<{
        values?: Array<{
          formattedValue?: string;
          effectiveFormat?: {
            textFormat?: {
              foregroundColorStyle?: { rgbColor?: RgbColor };
            };
          };
        }>;
      }>;
    }>;
  }>;
};

function isRedText(c: RgbColor | undefined): boolean {
  if (!c) return false;
  const r = c.red ?? 0;
  const g = c.green ?? 0;
  const b = c.blue ?? 0;
  return r >= 0.7 && g < 0.3 && b < 0.3;
}

export type ColorIndex = {
  redRows: Set<number>;
  available: boolean;
};

let warned = false;

export async function fetchRedRows(): Promise<ColorIndex> {
  const key = process.env.GOOGLE_SHEETS_API_KEY;
  if (!key) {
    if (!warned) {
      console.log("[sheetsColors] GOOGLE_SHEETS_API_KEY not set; skipping color detection");
      warned = true;
    }
    return { redRows: new Set(), available: false };
  }

  const range = `${SHEET_NAME}!A1:A5000`;
  const url =
    `https://sheets.googleapis.com/v4/spreadsheets/${SHEET_ID}` +
    `?ranges=${encodeURIComponent(range)}` +
    `&includeGridData=true` +
    `&fields=${encodeURIComponent(
      "sheets(data(rowData(values(formattedValue,effectiveFormat.textFormat.foregroundColorStyle))))"
    )}` +
    `&key=${encodeURIComponent(key)}`;

  try {
    const res = await fetch(url, {
      next: { revalidate: REVALIDATE_SECONDS, tags: ["vinilos-colors"] },
    });
    if (!res.ok) {
      console.warn(`[sheetsColors] fetch failed ${res.status}`);
      return { redRows: new Set(), available: false };
    }
    const data = (await res.json()) as ApiResponse;
    const rowData = data.sheets?.[0]?.data?.[0]?.rowData ?? [];
    const redRows = new Set<number>();
    rowData.forEach((row, idx) => {
      const color = row.values?.[0]?.effectiveFormat?.textFormat?.foregroundColorStyle?.rgbColor;
      if (isRedText(color)) redRows.add(idx);
    });
    console.log(`[sheetsColors] detected ${redRows.size} red rows`);
    return { redRows, available: true };
  } catch (err) {
    console.warn("[sheetsColors] error:", err);
    return { redRows: new Set(), available: false };
  }
}
