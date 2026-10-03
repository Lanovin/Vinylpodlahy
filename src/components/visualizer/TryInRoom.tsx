"use client";
import Link from "next/link";
import clsx from "clsx";
import { createContext, useContext, useState } from "react";
import type { PublicProduct } from "@/lib/public";
import { Cube } from "@/components/ui/icons";
import { preloadVisualizer, VisualizerDialog } from "./VisualizerDialog";
import { calcHref } from "./decor";

/** Sdílený stav karty produktu: plocha z mini-kalkulačky a otevření 3D (tlačítko na fotce, v BuyBoxu i ve spodní liště). */
interface ProductUi { area: string; setArea: (v: string) => void; areaM2: number | null; openViz: () => void }
const Ctx = createContext<ProductUi | null>(null);

export function useProductUi(): ProductUi {
  const c = useContext(Ctx);
  if (!c) throw new Error("useProductUi mimo ProductUiProvider");
  return c;
}

const parseArea = (v: string) => { const n = parseFloat(v.replace(",", ".")); return Number.isFinite(n) && n > 0 ? n : null; };

/** Obal karty produktu — drží plochu a jeden dialog s modelovým bytem (tento dekor, jeho kolekce a stejný odstín). */
export function ProductUiProvider({ product, products, sampleMax, children }: { product: PublicProduct; products: PublicProduct[]; sampleMax: number; children: React.ReactNode }) {
  const [area, setArea] = useState("");
  const [open, setOpen] = useState(false);
  const areaM2 = parseArea(area);
  const close = () => setOpen(false);
  return (
    <Ctx.Provider value={{ area, setArea, areaM2, openViz: () => setOpen(true) }}>
      {children}
      <VisualizerDialog
        open={open}
        onClose={close}
        title="Byt ve 3D"
        products={products}
        initialProductId={product.id}
        sampleMax={sampleMax}
        // Cena jde spočítat pro jakýkoli zvolený dekor (plocha z karty platí pro byt, ne pro dekor); detail jiné podlahy je vedlejší.
        renderActions={(p, { layout, compact }) => (
          <div className={compact ? "flex flex-row-reverse items-center gap-1.5" : "flex flex-col gap-2"}>
            <Link href={calcHref(p, layout, areaM2)} className={clsx("btn btn-accent", compact ? "btn-sm" : "w-full")} onClick={close}>Spočítat cenu</Link>
            {p.id !== product.id && <Link href={`/podlaha/${p.slug}`} className={clsx("btn btn-outline", compact ? "btn-sm !px-2.5" : "btn-sm w-full")} onClick={close}>{compact ? "Detail" : "Zobrazit podlahu"}</Link>}
          </div>
        )}
      />
    </Ctx.Provider>
  );
}

/** Tlačítko „Byt ve 3D“ — otevře modelový byt s touto podlahou. */
export function TryInRoom({ className, children }: { className?: string; children?: React.ReactNode }) {
  const { openViz } = useProductUi();
  return (
    <button type="button" className={clsx("btn", className)} onMouseEnter={preloadVisualizer} onFocus={preloadVisualizer} onPointerDown={preloadVisualizer} onClick={openViz}>
      {children ?? <><Cube className="h-4 w-4" /> Byt ve 3D</>}
    </button>
  );
}

/** Odkaz do kalkulačky s touto podlahou; nese plochu, pokud ji zákazník už zadal. */
export function ProductCalcLink({ product, className, children, tabIndex }: { product: Pick<PublicProduct, "slug">; className?: string; children: React.ReactNode; tabIndex?: number }) {
  const { areaM2 } = useProductUi();
  return <Link href={calcHref(product, null, areaM2)} className={className} tabIndex={tabIndex}>{children}</Link>;
}
