import raw from "../data/vinilos.json";
import type { Vinilo } from "./types";
import { fetchVinilos as fetchFromSheets, type FetchResult } from "./sheets";

export const vinilosFallback: Vinilo[] = raw as Vinilo[];

export async function loadVinilos(): Promise<FetchResult> {
  try {
    return await fetchFromSheets();
  } catch (err) {
    console.error("[vinilos] Sheets fetch failed, using JSON fallback:", err);
    return {
      vinilos: vinilosFallback,
      fetchedAt: new Date().toISOString(),
      source: "fallback",
    };
  }
}

export function uniqueValues(field: keyof Vinilo, list: Vinilo[]): string[] {
  const set = new Set<string>();
  for (const v of list) {
    const value = v[field];
    if (typeof value === "string" && value.trim()) set.add(value);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
}
