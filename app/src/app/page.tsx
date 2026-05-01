import Catalog from "../components/Catalog";
import { loadVinilos, uniqueValues } from "../lib/data";

export default async function Page() {
  const { vinilos, fetchedAt, source } = await loadVinilos();
  const formatos = uniqueValues("formato", vinilos);
  const generos = uniqueValues("genero", vinilos);
  const origenes = uniqueValues("origen", vinilos);

  const fetchedDate = new Date(fetchedAt);
  const fetchedLabel = fetchedDate.toLocaleString("es-CR", {
    dateStyle: "short",
    timeStyle: "short",
  });

  return (
    <>
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="absolute left-1/2 top-0 h-[600px] w-[1000px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-500/[0.06] blur-3xl" />
        <div className="absolute -left-32 top-1/3 h-[400px] w-[400px] rounded-full bg-amber-700/[0.04] blur-3xl" />
      </div>

      <main className="relative z-10 mx-auto max-w-7xl px-4 py-8 sm:py-14">
        <header className="mb-10 sm:mb-14">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-3">
              <img
                src="/logo-denki-records.svg"
                alt="Denki Records"
                className="h-10 w-auto sm:h-14"
              />
              <p className="text-sm text-zinc-500">
                {vinilos.length.toLocaleString("es")} títulos · vinilos, CDs y cassettes
              </p>
            </div>
            <div className="hidden items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-[11px] text-zinc-500 sm:flex">
              <span className={source === "sheets" ? "text-emerald-400" : "text-amber-400"}>●</span>
              <span>{source === "sheets" ? "Google Sheets · live" : "JSON local · fallback"}</span>
              <span className="text-zinc-700">· {fetchedLabel}</span>
            </div>
          </div>
        </header>

        <Catalog
          vinilos={vinilos}
          formatos={formatos}
          generos={generos}
          origenes={origenes}
        />

        <footer className="mt-20 border-t border-white/[0.04] pt-8 text-center text-xs text-zinc-700">
          Datos {source === "sheets" ? "en vivo desde Google Sheets" : "desde caché local"},
          revalidan cada 10 minutos · Portadas vía Discogs / iTunes.
        </footer>
      </main>
    </>
  );
}
