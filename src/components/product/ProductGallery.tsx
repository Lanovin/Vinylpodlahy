"use client";
import Image from "next/image";
import { useState } from "react";
import clsx from "clsx";

export function ProductGallery({ images, alt }: { images: string[]; alt: string }) {
  const list = images.filter(Boolean);
  const [i, setI] = useState(0);
  if (list.length === 0) return <div className="aspect-[4/3] rounded-md bg-line grid place-items-center text-muted">Fotografie se připravuje</div>;
  return (
    <div>
      <div className="relative aspect-[4/3] rounded-md overflow-hidden bg-line">
        <Image key={list[i]} src={list[i]} alt={alt} fill priority sizes="(max-width: 1024px) 100vw, 60vw" className="object-cover" />
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
  );
}
