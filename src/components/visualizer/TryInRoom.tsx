"use client";
import Link from "next/link";
import clsx from "clsx";
import { useState } from "react";
import type { PublicProduct } from "@/lib/public";
import { Cube } from "@/components/ui/icons";
import { preloadVisualizer, VisualizerDialog } from "./VisualizerDialog";

/** Tlačítko „Vyzkoušet v interiéru“ na kartě produktu — otevře modelový byt s touto podlahou. */
export function TryInRoom({ product, products, sampleMax, className }: { product: PublicProduct; products: PublicProduct[]; sampleMax: number; className?: string }) {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);
  return (
    <>
      <button type="button" className={clsx("btn btn-sm bg-white/95 text-ink shadow-card hover:bg-white", className)} onMouseEnter={preloadVisualizer} onFocus={preloadVisualizer} onClick={() => setOpen(true)}>
        <Cube className="h-4 w-4" /> Vyzkoušet v interiéru
      </button>
      <VisualizerDialog
        open={open}
        onClose={close}
        title="Vyzkoušet v interiéru"
        subtitle={`${product.brand} ${product.collection} — modelový byt 2+kk`}
        products={products}
        initialProductId={product.id}
        sampleMax={sampleMax}
        renderActions={(p) => p.id === product.id
          ? <button type="button" className="btn btn-primary btn-sm" onClick={close}>Zpět k nákupu</button>
          : <Link href={`/podlaha/${p.slug}`} className="btn btn-primary btn-sm" onClick={close}>Zobrazit tuto podlahu</Link>}
      />
    </>
  );
}
