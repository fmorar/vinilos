"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import type { Vinilo } from "../lib/types";
import CoverImage from "./CoverImage";

type Props = {
  vinilos: Vinilo[];
  formatos: string[];
  generos: string[];
  origenes: string[];
};

type CartItem = { vinilo: Vinilo; qty: number };

const PAGE_SIZE = 60;
const WA_NUMBER = "50670500186";

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function matches(v: Vinilo, q: string): boolean {
  if (!q) return true;
  const haystack = normalize(
    `${v.artista} ${v.titulo} ${v.sello} ${v.catalogo} ${v.genero} ${v.notas} ${v.anio} ${v.origen}`
  );
  const tokens = normalize(q).split(/\s+/).filter(Boolean);
  return tokens.every((t) => haystack.includes(t));
}

export default function Catalog({ vinilos, formatos, generos, origenes }: Props) {
  const [query, setQuery] = useState("");
  const [formato, setFormato] = useState("");
  const [genero, setGenero] = useState("");
  const [origen, setOrigen] = useState("");
  const [orden, setOrden] = useState<"artista" | "anio" | "precio">("artista");
  const [soloNuevos, setSoloNuevos] = useState(false);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Vinilo | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);

  const deferredQuery = useDeferredValue(query);

  const totalNuevos = useMemo(
    () => vinilos.reduce((n, v) => (v.nuevo ? n + 1 : n), 0),
    [vinilos]
  );

  const filtered = useMemo(() => {
    const out = vinilos.filter((v) => {
      if (formato && v.formato !== formato) return false;
      if (genero && v.genero !== genero) return false;
      if (origen && v.origen !== origen) return false;
      if (soloNuevos && !v.nuevo) return false;
      if (!matches(v, deferredQuery)) return false;
      return true;
    });
    out.sort((a, b) => {
      if (orden === "artista") return a.artista.localeCompare(b.artista, "es");
      if (orden === "anio") {
        const ay = parseInt(a.anio) || 0;
        const by = parseInt(b.anio) || 0;
        return by - ay;
      }
      const ap = a.precio ?? Infinity;
      const bp = b.precio ?? Infinity;
      return ap - bp;
    });
    return out;
  }, [vinilos, formato, genero, origen, soloNuevos, deferredQuery, orden]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const visible = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  const cartCount = cart.reduce((s, i) => s + i.qty, 0);

  function addToCart(v: Vinilo) {
    setCart((prev) => {
      const existing = prev.find((i) => i.vinilo.id === v.id);
      if (existing) return prev.map((i) => i.vinilo.id === v.id ? { ...i, qty: i.qty + 1 } : i);
      return [...prev, { vinilo: v, qty: 1 }];
    });
  }

  function removeFromCart(id: number) {
    setCart((prev) => prev.filter((i) => i.vinilo.id !== id));
  }

  function updateQty(id: number, qty: number) {
    if (qty <= 0) return removeFromCart(id);
    setCart((prev) => prev.map((i) => i.vinilo.id === id ? { ...i, qty } : i));
  }

  function isInCart(id: number) {
    return cart.some((i) => i.vinilo.id === id);
  }

  function reset() {
    setQuery("");
    setFormato("");
    setGenero("");
    setOrigen("");
    setOrden("artista");
    setSoloNuevos(false);
    setPage(1);
  }

  const selectCls =
    "min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2 text-sm text-zinc-300 outline-none transition focus:border-amber-500/40 hover:border-white/[0.14]";

  return (
    <div className="space-y-6">
      {/* Filter bar */}
      <div className="sticky top-0 z-30 -mx-4 space-y-3 border-b border-white/[0.06] bg-zinc-950/85 px-4 py-4 backdrop-blur-xl sm:mx-0 sm:rounded-2xl sm:border sm:border-white/[0.06]">
        <div className="relative">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
            className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-600">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
          </svg>
          <input
            type="search"
            placeholder="Buscar artista, título, sello, género…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setPage(1); }}
            className="w-full rounded-xl border border-white/[0.08] bg-white/[0.04] py-2.5 pl-10 pr-4 text-sm text-zinc-200 outline-none placeholder:text-zinc-600 transition focus:border-amber-500/40 focus:bg-white/[0.06]"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          <select value={formato} onChange={(e) => { setFormato(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Formato (todos)</option>
            {formatos.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
          <select value={genero} onChange={(e) => { setGenero(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Género (todos)</option>
            {generos.map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
          <select value={origen} onChange={(e) => { setOrigen(e.target.value); setPage(1); }} className={selectCls}>
            <option value="">Origen (todos)</option>
            {origenes.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
          <select value={orden} onChange={(e) => setOrden(e.target.value as "artista" | "anio" | "precio")} className={selectCls}>
            <option value="artista">Orden: A–Z</option>
            <option value="anio">Orden: año ↓</option>
            <option value="precio">Orden: precio ↑</option>
          </select>
          {totalNuevos > 0 && (
            <button
              onClick={() => { setSoloNuevos((v) => !v); setPage(1); }}
              className={`min-w-0 truncate rounded-xl border px-3 py-2 text-sm transition ${
                soloNuevos
                  ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                  : "border-white/[0.08] text-zinc-400 hover:border-rose-500/40 hover:text-rose-300"
              }`}
            >
              {soloNuevos ? "✓ " : ""}Nuevos · {totalNuevos.toLocaleString("es")}
            </button>
          )}
          <button onClick={reset} className="min-w-0 rounded-xl border border-white/[0.08] px-3 py-2 text-sm text-zinc-500 transition hover:border-amber-500/40 hover:text-amber-400">
            Limpiar
          </button>
        </div>

        <div className="text-xs text-zinc-600">
          {filtered.length.toLocaleString("es")} vinilos ·{" "}
          <span className="text-zinc-400">página {safePage}</span> de {totalPages}
          {soloNuevos && <span className="ml-2 text-rose-400">· filtrando nuevos</span>}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
        {visible.map((v) => {
          const inCart = isInCart(v.id);
          return (
            <div
              key={v.id}
              onClick={() => setSelected(v)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === "Enter" && setSelected(v)}
              className={`group relative flex cursor-pointer flex-col rounded-2xl border text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/50 ${
                v.nuevo
                  ? "border-rose-500/25 bg-rose-950/10 hover:border-rose-400/40 hover:bg-rose-950/20"
                  : inCart
                  ? "border-amber-500/30 bg-amber-500/[0.04] hover:border-amber-500/50"
                  : "border-white/[0.06] bg-white/[0.02] hover:border-white/[0.12] hover:bg-white/[0.04]"
              }`}
            >
              {v.nuevo && (
                <span className="pointer-events-none absolute right-2.5 top-2.5 z-10 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg shadow-rose-500/20">
                  Nuevo
                </span>
              )}
              <div className="p-2">
                <CoverImage artista={v.artista} titulo={v.titulo} formato={v.formato} did={v.did} />
              </div>
              <div className="flex flex-1 flex-col gap-1 px-3 pb-3">
                <div className={`truncate text-sm font-semibold leading-tight transition-colors ${
                  v.nuevo ? "text-rose-300 group-hover:text-rose-200" : "text-zinc-100 group-hover:text-amber-400"
                }`}>
                  {v.artista}
                </div>
                <div className="line-clamp-2 text-xs leading-snug text-zinc-500">{v.titulo}</div>
                <div className="mt-auto flex items-center justify-between pt-2">
                  <span className="text-[10px] text-zinc-700">{v.formato}</span>
                  <div className="flex items-center gap-2">
                    {v.precio !== null && (
                      <span className="text-xs font-medium text-amber-400">${v.precio.toFixed(2)}</span>
                    )}
                    <button
                      onClick={(e) => { e.stopPropagation(); inCart ? removeFromCart(v.id) : addToCart(v); }}
                      title={inCart ? "Quitar del carrito" : "Agregar al carrito"}
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs transition ${
                        inCart
                          ? "border-amber-500/60 bg-amber-500/15 text-amber-400 hover:border-rose-500/60 hover:bg-rose-500/10 hover:text-rose-400"
                          : "border-white/[0.12] bg-white/[0.04] text-zinc-500 hover:border-amber-500/40 hover:text-amber-400"
                      }`}
                    >
                      {inCart ? "✓" : "+"}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-2xl border border-dashed border-white/[0.06] p-12 text-center text-zinc-600">
          Sin resultados. Probá otros filtros.
        </div>
      )}

      {totalPages > 1 && (
        <Pagination page={safePage} totalPages={totalPages} setPage={setPage} />
      )}

      {/* Floating cart button */}
      {cartCount > 0 && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-2.5 rounded-full border border-amber-500/40 bg-zinc-950 px-4 py-3 shadow-2xl shadow-black/60 transition hover:border-amber-500/70 hover:bg-zinc-900"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5 text-amber-400">
            <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
            <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
          </svg>
          <span className="text-sm font-semibold text-amber-400">{cartCount}</span>
          <span className="text-sm text-zinc-300">
            {cartCount === 1 ? "disco" : "discos"}
          </span>
        </button>
      )}

      {selected && (
        <Modal
          vinilo={selected}
          inCart={isInCart(selected.id)}
          onAddToCart={() => addToCart(selected)}
          onRemoveFromCart={() => removeFromCart(selected.id)}
          onClose={() => setSelected(null)}
        />
      )}

      {cartOpen && (
        <CartPanel
          cart={cart}
          onClose={() => setCartOpen(false)}
          onRemove={removeFromCart}
          onQtyChange={updateQty}
        />
      )}
    </div>
  );
}

// ─── Cart Panel ───────────────────────────────────────────────────────────────

function CartPanel({
  cart,
  onClose,
  onRemove,
  onQtyChange,
}: {
  cart: CartItem[];
  onClose: () => void;
  onRemove: (id: number) => void;
  onQtyChange: (id: number, qty: number) => void;
}) {
  const total = cart.reduce((s, i) => s + (i.vinilo.precio ?? 0) * i.qty, 0);
  const hasPrice = cart.some((i) => i.vinilo.precio !== null);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function sendWhatsApp() {
    const lines = cart.map((i) => {
      const precio = i.vinilo.precio !== null
        ? ` — $${(i.vinilo.precio * i.qty).toFixed(2)}${i.qty > 1 ? ` (${i.qty}x $${i.vinilo.precio.toFixed(2)})` : ""}`
        : "";
      return `• ${i.vinilo.artista} – ${i.vinilo.titulo} (${i.vinilo.formato})${precio}`;
    });

    let msg = `Hola! Me interesan estos discos de Denki Records:\n\n${lines.join("\n")}`;
    if (hasPrice) msg += `\n\nTotal estimado: $${total.toFixed(2)}`;
    msg += `\n\n¿Están disponibles? 🙏`;

    window.open(`https://wa.me/${WA_NUMBER}?text=${encodeURIComponent(msg)}`, "_blank");
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      <div
        className="relative flex h-full w-full max-w-sm flex-col border-l border-white/[0.08] bg-zinc-950 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <h2 className="font-semibold text-zinc-100">Carrito</h2>
            <p className="text-xs text-zinc-600">{cart.length} {cart.length === 1 ? "disco" : "discos"}</p>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-sm text-zinc-400 transition hover:bg-white/[0.10] hover:text-zinc-100"
          >✕</button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {cart.map((item) => (
            <div key={item.vinilo.id} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-lg">
                <CoverImage
                  artista={item.vinilo.artista}
                  titulo={item.vinilo.titulo}
                  formato={item.vinilo.formato}
                  did={item.vinilo.did}
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-zinc-100">{item.vinilo.artista}</div>
                <div className="line-clamp-1 text-xs text-zinc-500">{item.vinilo.titulo}</div>
                <div className="mt-1 text-[11px] text-zinc-700">{item.vinilo.formato}</div>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={() => onQtyChange(item.vinilo.id, item.qty - 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.10] text-zinc-400 hover:border-white/[0.20] hover:text-zinc-200 transition"
                    >−</button>
                    <span className="w-5 text-center text-sm text-zinc-300">{item.qty}</span>
                    <button
                      onClick={() => onQtyChange(item.vinilo.id, item.qty + 1)}
                      className="flex h-6 w-6 items-center justify-center rounded-full border border-white/[0.10] text-zinc-400 hover:border-white/[0.20] hover:text-zinc-200 transition"
                    >+</button>
                  </div>
                  {item.vinilo.precio !== null && (
                    <span className="text-sm font-medium text-amber-400">
                      ${(item.vinilo.precio * item.qty).toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={() => onRemove(item.vinilo.id)}
                className="shrink-0 text-zinc-700 hover:text-rose-400 transition"
                title="Eliminar"
              >✕</button>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="border-t border-white/[0.06] px-5 py-4 space-y-3">
          {hasPrice && (
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-400">Total estimado</span>
              <span className="text-xl font-bold text-amber-400">${total.toFixed(2)}</span>
            </div>
          )}
          <button
            onClick={sendWhatsApp}
            className="flex w-full items-center justify-center gap-2.5 rounded-xl bg-[#25D366] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#25D366]/20 transition hover:bg-[#20c45c] active:scale-[0.98]"
          >
            <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
            Enviar pedido por WhatsApp
          </button>
          <p className="text-center text-[11px] text-zinc-700">
            Los precios son referenciales · sujeto a disponibilidad
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Modal ────────────────────────────────────────────────────────────────────

type Track = { position: string; title: string; duration: string; isHeading: boolean };

function useTracklist(did?: string) {
  const [tracks, setTracks] = useState<Track[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!did) return;
    setTracks(null);
    setLoading(true);
    fetch(`/api/tracklist?did=${encodeURIComponent(did)}`)
      .then((r) => r.json())
      .then((d) => setTracks(d.tracks ?? null))
      .catch(() => setTracks(null))
      .finally(() => setLoading(false));
  }, [did]);

  return { tracks, loading };
}

function Modal({
  vinilo,
  inCart,
  onAddToCart,
  onRemoveFromCart,
  onClose,
}: {
  vinilo: Vinilo;
  inCart: boolean;
  onAddToCart: () => void;
  onRemoveFromCart: () => void;
  onClose: () => void;
}) {
  const { tracks, loading } = useTracklist(vinilo.did);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm sm:items-center"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-3xl rounded-2xl border border-white/[0.08] bg-zinc-950 shadow-2xl shadow-black/60"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.05] text-sm text-zinc-400 transition hover:bg-white/[0.10] hover:text-zinc-100"
          aria-label="Cerrar"
        >✕</button>

        <div className="grid gap-0 sm:grid-cols-[220px_1fr]">
          {/* Left */}
          <div className="p-5">
            <div className="overflow-hidden rounded-xl">
              <CoverImage artista={vinilo.artista} titulo={vinilo.titulo} formato={vinilo.formato} did={vinilo.did} />
            </div>
            {vinilo.precio !== null && (
              <div className="mt-4 text-2xl font-bold text-amber-400">${vinilo.precio.toFixed(2)}</div>
            )}
            {vinilo.did && (
              <a
                href={`https://www.discogs.com/release/${vinilo.did}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1.5 block text-xs text-zinc-600 transition hover:text-amber-400"
              >Discogs · {vinilo.did} ↗</a>
            )}

            {/* Cart button */}
            <button
              onClick={inCart ? onRemoveFromCart : onAddToCart}
              className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                inCart
                  ? "border-amber-500/40 bg-amber-500/10 text-amber-400 hover:border-rose-500/40 hover:bg-rose-500/10 hover:text-rose-400"
                  : "border-white/[0.10] bg-white/[0.04] text-zinc-300 hover:border-amber-500/40 hover:text-amber-400"
              }`}
            >
              {inCart ? (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  En el carrito · quitar
                </>
              ) : (
                <>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-4 w-4">
                    <circle cx="9" cy="21" r="1" /><circle cx="20" cy="21" r="1" />
                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6" />
                  </svg>
                  Agregar al carrito
                </>
              )}
            </button>
          </div>

          {/* Right */}
          <div className="min-w-0 space-y-4 overflow-y-auto p-5 pl-0 sm:max-h-[80vh]">
            <div className="pr-8">
              <h2 className="text-xl font-bold text-zinc-50">{vinilo.artista}</h2>
              <p className="mt-0.5 text-zinc-400">{vinilo.titulo}</p>
            </div>

            <dl className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
              <Field label="Formato" value={vinilo.formato} />
              <Field label="Detalle" value={vinilo.formato_extra} />
              <Field label="Sello" value={vinilo.sello} />
              <Field label="Catálogo" value={vinilo.catalogo} />
              <Field label="Origen" value={vinilo.origen} />
              <Field label="Año" value={vinilo.anio} />
              <Field label="Género" value={vinilo.genero} />
              <Field label="Disco" value={vinilo.condicion_disco} />
              <Field label="Portada" value={vinilo.condicion_portada} />
            </dl>

            {vinilo.notas && (
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-3">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Notas</div>
                <p className="whitespace-pre-wrap text-sm text-zinc-300">{vinilo.notas}</p>
              </div>
            )}

            {vinilo.did && (
              <div>
                <div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Tracklist</div>
                {loading ? (
                  <div className="space-y-2">
                    {[...Array(6)].map((_, i) => (
                      <div key={i} className="h-3.5 animate-pulse rounded-full bg-white/[0.05]"
                        style={{ width: `${55 + (i % 3) * 18}%` }} />
                    ))}
                  </div>
                ) : tracks && tracks.length > 0 ? (
                  <ol className="space-y-0.5">
                    {tracks.map((t, i) =>
                      t.isHeading ? (
                        <li key={i} className="pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-600">
                          {t.title}
                        </li>
                      ) : (
                        <li key={i} className="flex items-baseline gap-2 rounded-lg px-2 py-1 text-sm transition hover:bg-white/[0.03]">
                          {t.position && <span className="w-6 shrink-0 text-right text-[11px] text-zinc-700">{t.position}</span>}
                          <span className="flex-1 text-zinc-300">{t.title}</span>
                          {t.duration && <span className="shrink-0 text-[11px] tabular-nums text-zinc-700">{t.duration}</span>}
                        </li>
                      )
                    )}
                  </ol>
                ) : !loading && tracks !== null ? (
                  <p className="text-xs text-zinc-700">Sin tracklist disponible.</p>
                ) : null}
              </div>
            )}

            {vinilo.urls.length > 0 && (
              <div className="space-y-1">
                <div className="mb-1 text-[11px] font-medium uppercase tracking-wider text-zinc-600">Enlaces</div>
                {vinilo.urls.map((u, i) => (
                  <a key={i} href={u} target="_blank" rel="noopener noreferrer"
                    className="block break-all text-sm text-amber-400 hover:underline">{u}</a>
                ))}
              </div>
            )}

            <div className="flex flex-wrap gap-2 pt-1">
              <ExternalLink label="Discogs" href={`https://www.discogs.com/search/?q=${encodeURIComponent(`${vinilo.artista} ${vinilo.titulo}`)}&type=all`} />
              <ExternalLink label="YouTube" href={`https://www.youtube.com/results?search_query=${encodeURIComponent(`${vinilo.artista} ${vinilo.titulo}`)}`} />
              <ExternalLink label="Spotify" href={`https://open.spotify.com/search/${encodeURIComponent(`${vinilo.artista} ${vinilo.titulo}`)}`} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({ page, totalPages, setPage }: { page: number; totalPages: number; setPage: (p: number) => void }) {
  const [input, setInput] = useState("");

  function goTo(p: number) {
    const clamped = Math.min(totalPages, Math.max(1, p));
    setPage(clamped);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function pageNumbers(): (number | "…")[] {
    const delta = 1;
    const range: (number | "…")[] = [];
    let last = 0;
    for (let i = 1; i <= totalPages; i++) {
      if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
        if (last && i - last > 1) range.push("…");
        range.push(i);
        last = i;
      }
    }
    return range;
  }

  const btn = "min-w-[2.25rem] rounded-xl border px-2 py-1.5 text-sm transition";

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 pb-12">
      <button disabled={page === 1} onClick={() => goTo(page - 1)}
        className={`${btn} border-white/[0.08] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200 disabled:opacity-25`}>←</button>

      {pageNumbers().map((p, i) =>
        p === "…" ? (
          <span key={`e-${i}`} className="px-1 text-sm text-zinc-700">…</span>
        ) : (
          <button key={p} onClick={() => goTo(p)}
            className={`${btn} ${p === page
              ? "border-amber-500/60 bg-amber-500/10 text-amber-400"
              : "border-white/[0.08] text-zinc-400 hover:border-amber-500/30 hover:text-amber-400"
            }`}>{p}</button>
        )
      )}

      <button disabled={page === totalPages} onClick={() => goTo(page + 1)}
        className={`${btn} border-white/[0.08] text-zinc-400 hover:border-white/[0.16] hover:text-zinc-200 disabled:opacity-25`}>→</button>

      <form
        onSubmit={(e) => { e.preventDefault(); const n = parseInt(input); if (!isNaN(n)) goTo(n); setInput(""); }}
        className="flex items-center gap-1.5"
      >
        <input type="number" min={1} max={totalPages} value={input} onChange={(e) => setInput(e.target.value)}
          placeholder="ir a…"
          className="w-20 rounded-xl border border-white/[0.08] bg-white/[0.04] px-2 py-1.5 text-sm text-zinc-300 placeholder:text-zinc-700 focus:border-amber-500/40 focus:outline-none" />
        <button type="submit" className={`${btn} border-white/[0.08] text-zinc-400 hover:border-amber-500/30 hover:text-amber-400`}>ir</button>
      </form>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-medium uppercase tracking-wider text-zinc-600">{label}</dt>
      <dd className="truncate text-sm text-zinc-300">{value}</dd>
    </div>
  );
}

function ExternalLink({ label, href }: { label: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400 transition hover:border-amber-500/40 hover:text-amber-400">
      {label} ↗
    </a>
  );
}
