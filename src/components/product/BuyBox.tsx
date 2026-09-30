"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicProduct, PublicSettings } from "@/lib/public";
import { quickPacks } from "@/lib/calc";
import { estimateProductShipping } from "@/lib/shipping";
import { fmtCzk, fmtInt, fmtNum2 } from "@/lib/format";
import { useCart } from "@/store/cart";
import { SampleButton } from "./SampleButton";
import { ArrowRight, Check, Cube, Minus, Plus, Ruler, Truck } from "@/components/ui/icons";
import { ProductCalcLink, TryInRoom, useProductUi } from "@/components/visualizer/TryInRoom";
import { preloadVisualizer } from "@/components/visualizer/VisualizerDialog";

export function BuyBox({ p, settings }: { p: PublicProduct; settings: PublicSettings }) {
  const { area, setArea, areaM2, openViz } = useProductUi();
  const [packsManual, setPacksManual] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const [flash, setFlash] = useState(false);
  const [added, setAdded] = useState(false);
  const boxRef = useRef<HTMLDivElement>(null);
  const [boxVisible, setBoxVisible] = useState(true);

  const quick = useMemo(() => quickPacks(p, areaM2 ?? 0), [p, areaM2]);
  const packs = packsManual ?? (quick.packs || 1);
  const total = packs * p.pricePerPack;
  const ship = useMemo(() => estimateProductShipping(p, packs, settings), [p, packs, settings]);
  const m2 = packs * p.m2PerPack;
  const overStock = m2 > p.stockM2;
  const inStock = p.stockM2 > 0;

  // Spodní lišta na telefonu se ukáže, až BuyBox odjede z obrazovky.
  useEffect(() => {
    const el = boxRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setBoxVisible(e.isIntersecting), { rootMargin: "0px 0px -80px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const addToCart = () => { add({ kind: "product", id: p.id, qty: packs }); setAdded(true); setFlash(true); setTimeout(() => setFlash(false), 2500); };

  return (
    <>
      <div ref={boxRef} className="panel lg:sticky lg:top-24">
        <p className="text-3xl leading-none">{fmtCzk(p.pricePerM2)}<span className="text-base text-muted"> / m²</span></p>
        <p className="text-sm text-ink-soft mt-2">{fmtCzk(p.pricePerPack)} za balení ({fmtNum2(p.m2PerPack)} m²) · prodáváme po celých baleních</p>
        <p className={`text-sm mt-1 ${inStock ? "text-ok" : "text-danger"}`}>{inStock ? `Skladem ${fmtInt(p.stockM2)} m² · u vás do ${p.deliveryDays} prac. dnů` : "Momentálně nedostupné"}</p>

        <div className="divider my-4" />

        {/* Mini-kalkulačka: plocha → balení s 5% prořezem */}
        <label className="label" htmlFor="area">Plocha místnosti</label>
        <div className="relative">
          <input id="area" inputMode="decimal" enterKeyHint="done" className="input pr-12" placeholder="např. 18,5" value={area} onChange={(e) => { setArea(e.target.value); setPacksManual(null); }} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">m²</span>
        </div>
        {quick.packs > 0 && <p className="text-sm text-ink-soft mt-2"><strong>{quick.packs} balení</strong> = {fmtNum2(quick.coveredM2)} m² (s 5% prořezem)</p>}

        <div className="mt-4 flex items-center gap-3">
          <div className="inline-flex items-center border border-line-strong rounded-sm bg-white">
            <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Méně balení" onClick={() => setPacksManual(Math.max(1, packs - 1))}><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center tabular-nums" aria-live="polite">{packs}</span>
            <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Více balení" onClick={() => setPacksManual(packs + 1)}><Plus className="h-4 w-4" /></button>
          </div>
          <div className="text-sm text-muted leading-tight">bal. = <span className="text-ink whitespace-nowrap">{fmtNum2(m2)} m²</span></div>
          <div className="ml-auto text-xl tabular-nums whitespace-nowrap">{fmtCzk(total)}</div>
        </div>
        {overStock && <p className="notice notice-warn mt-3 text-sm">Skladem je {fmtInt(p.stockM2)} m². Zbytek doobjednáme u výrobce a ozveme se s termínem.</p>}

        <p className="mt-3 text-sm text-ink-soft flex items-start gap-2">
          <Truck className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Doprava {ship.free ? <strong className="font-normal text-ok">zdarma</strong> : fmtCzk(ship.price)}{ship.method === "pallet" ? " · paleta ke krajnici (vynášku nabídneme v košíku)" : ""}{!ship.free && ` · zdarma od ${settings.freeShippingFromM2} m²`}</span>
        </p>

        <div className="mt-5 grid gap-2">
          <button type="button" className="btn btn-accent btn-lg w-full" disabled={!inStock} onClick={addToCart}>
            {flash ? <><Check className="h-5 w-5" /> Přidáno do košíku</> : `Do košíku · ${packs} balení`}
          </button>
          {added && <Link href="/kosik" className="btn btn-outline w-full">Přejít do košíku <ArrowRight className="h-4 w-4" /></Link>}
          <ProductCalcLink product={p} className="btn btn-primary w-full"><Ruler className="h-4 w-4" /> Spočítat na můj byt</ProductCalcLink>
          <div className="grid grid-cols-2 gap-2">
            <TryInRoom className="btn-outline w-full !px-2"><Cube className="h-4 w-4 shrink-0" /> Ve 3D bytě</TryInRoom>
            <SampleButton productId={p.id} max={settings.samples.max} compact className="w-full [&>button]:w-full [&>button]:!px-2" />
          </div>
          <Link href={`/montaz?product=${p.slug}`} className="inline-flex items-center justify-center gap-1.5 h-11 text-sm text-ink-soft hover:text-ink">Chci i pokládku <ArrowRight className="h-4 w-4" /></Link>
        </div>
      </div>

      {/* Spodní lišta na telefonu: cena a hlavní akce i po odscrollování */}
      <div className={`lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${boxVisible ? "translate-y-full" : "translate-y-0"}`} aria-hidden={boxVisible}>
        <div className="container py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-lg tabular-nums">{fmtCzk(p.pricePerM2)}<span className="text-xs text-muted"> / m²</span></p>
            <p className="text-xs text-muted truncate">{fmtCzk(p.pricePerPack)} / bal.</p>
          </div>
          <button type="button" tabIndex={boxVisible ? -1 : undefined} className="btn btn-outline !px-0 w-11 shrink-0" onPointerDown={preloadVisualizer} onClick={openViz} aria-label="Vyzkoušet ve 3D bytě"><Cube className="h-5 w-5" /></button>
          {quick.packs > 0 && inStock
            ? <button type="button" tabIndex={boxVisible ? -1 : undefined} className="btn btn-accent shrink-0" onClick={addToCart}>{flash ? <><Check className="h-4 w-4" /> Přidáno</> : `Do košíku · ${packs} bal.`}</button>
            : <ProductCalcLink product={p} className="btn btn-accent shrink-0">Spočítat cenu</ProductCalcLink>}
        </div>
      </div>
    </>
  );
}
