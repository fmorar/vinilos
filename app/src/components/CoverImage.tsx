"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";

type Props = {
  artista: string;
  titulo: string;
  formato: string;
  did?: string;
};

const sessionCache = new Map<string, string | null>();

export default function CoverImage({ artista, titulo, formato, did }: Props) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  const [url, setUrl] = useState<string | null | undefined>(undefined);

  useEffect(() => {
    if (!ref.current) return;
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "300px" }
    );
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!visible) return;
    const key = `${did || ""}::${artista}::${titulo}`.toLowerCase();
    if (sessionCache.has(key)) {
      setUrl(sessionCache.get(key) ?? null);
      return;
    }
    let aborted = false;
    const params = new URLSearchParams({ artista, titulo });
    if (did) params.set("did", did);
    fetch(`/api/cover?${params.toString()}`)
      .then((r) => r.json())
      .then((data: { url: string | null }) => {
        if (aborted) return;
        sessionCache.set(key, data.url);
        setUrl(data.url);
      })
      .catch(() => {
        if (!aborted) setUrl(null);
      });
    return () => {
      aborted = true;
    };
  }, [visible, artista, titulo, did]);

  const isVinyl = /vinilo/i.test(formato);
  const placeholder = (
    <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-zinc-800 to-zinc-950 text-zinc-600">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        className="h-10 w-10"
      >
        {isVinyl ? (
          <>
            <circle cx="12" cy="12" r="9" />
            <circle cx="12" cy="12" r="3" />
            <circle cx="12" cy="12" r="1" fill="currentColor" />
          </>
        ) : (
          <rect x="4" y="4" width="16" height="16" rx="1" />
        )}
      </svg>
    </div>
  );

  return (
    <div
      ref={ref}
      className="relative aspect-square w-full overflow-hidden rounded-md bg-zinc-900"
    >
      {url ? (
        <Image
          src={url}
          alt={`${artista} - ${titulo}`}
          fill
          sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 200px"
          className="object-cover"
          unoptimized
        />
      ) : url === null ? (
        placeholder
      ) : (
        <div className="h-full w-full animate-pulse bg-zinc-800" />
      )}
    </div>
  );
}
