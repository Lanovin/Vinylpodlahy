"use client";
import Image from "next/image";
import { useState } from "react";
import clsx from "clsx";

/** Na telefonu fotky posouvané prstem (s počítadlem), od tabletu velká fotka s náhledy. */
export function ProductGallery({ images, alt, children }: { images: string[]; alt: string; /** Překryv přes hlavní fotku (tlačítko 3D). */ children?: React.ReactNode }) {
  const list = images.filter(Boolean);
  const [i, setI] = useState(0);
  const [swiped, setSwiped] = useState(0);
  if (list.length === 0) return <div className="relative aspect-[4/3] rounded-md bg-line grid place-items-center text-muted">Fotografie se připravuje{children}</div>;
  return (
    <div>
      <div className="relative sm:hidden -mx-4">
        <div className="flex overflow-x-auto snap-x snap-mandatory no-scrollbar" onScroll={(e) => { const el = e.currentTarget; setSwiped(Math.round(el.scrollLeft / el.clientWidth)); }}>
          {list.map((src, idx) => (
            <div key={src} className="relative aspect-[4/3] w-full shrink-0 snap-center bg-line">
              <Image src={src} alt={idx === 0 ? alt : ""} fill priority={idx === 0} sizes="100vw" className="object-cover" />
            </div>
          ))}
        </div>
        {list.length > 1 && <span className="absolute right-3 bottom-3 rounded-full bg-ink/70 text-white text-xs px-2.5 py-1 tabular-nums pointer-events-none">{swiped + 1} / {list.length}</span>}
        {children}
      </div>
      <div className="hidden sm:block">
        <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-line">
          <Image key={list[i]} src={list[i]} alt={alt} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
          {children}
        </div>
        {list.length > 1 && (
          <div className="mt-3 grid grid-cols-4 gap-2">
            {list.map((src, idx) => (
              <button key={src} type="button" onClick={() => setI(idx)} className={clsx("relative aspect-[4/3] rounded-sm overflow-hidden border-2", idx === i ? "border-ink" : "border-transparent hover:border-line-strong")} aria-label={`Fotografie ${idx + 1}`}>
                <Image src={src} alt="" fill sizes="20vw" className="object-cover" />
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
