"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import type { PublicProduct, PublicSettings } from "@/lib/public";
import { quickPacks } from "@/lib/calc";
import { estimateProductShipping } from "@/lib/shipping";
import { fmtCzk, fmtInt, fmtNum2 } from "@/lib/format";
import { useCart } from "@/store/cart";
import { SampleButton } from "./SampleButton";
import { ArrowRight, Check, Cube, Hammer, Minus, Plus, Ruler, Truck } from "@/components/ui/icons";
import { ProductCalcLink, TryInRoom, useProductUi } from "@/components/visualizer/TryInRoom";
import { preloadVisualizer } from "@/components/visualizer/VisualizerDialog";

/**
 * Nákupní box karty produktu. Hierarchie: 1) „Spočítat cenu“ (kalkulačka s touto podlahou — balení, podložka,
 * lišty, doprava), 2) „Do košíku“ s mini-kalkulačkou m² → balení, 3) méně výrazné: Byt ve 3D, Vzorek zdarma, Poptat pokládku.
 */
export function BuyBox({ p, settings }: { p: PublicProduct; settings: PublicSettings }) {
  const { area, setArea, areaM2, openViz } = useProductUi();
  const [packsManual, setPacksManual] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const [flash, setFlash] = useState(false);
  const [added, setAdded] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);

  const quick = useMemo(() => quickPacks(p, areaM2 ?? 0), [p, areaM2]);
  const packs = packsManual ?? (quick.packs || 1);
  const total = packs * p.pricePerPack;
  const ship = useMemo(() => estimateProductShipping(p, packs, settings), [p, packs, settings]);
  const m2 = packs * p.m2PerPack;
  const overStock = m2 > p.stockM2;
  const inStock = p.stockM2 > 0;
  const noArea = quick.packs === 0 && packsManual === null;

  // Spodní lišta na telefonu: hlavní akce je vždy na očích — ukáže se, kdykoli hlavní tlačítko není vidět
  // (i hned po načtení, když je pod ohybem).
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setCtaVisible(e.isIntersecting), { rootMargin: "0px 0px -72px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const addToCart = () => { add({ kind: "product", id: p.id, qty: packs }); setAdded(true); setFlash(true); setTimeout(() => setFlash(false), 2500); };

  return (
    <>
      <div className="panel lg:sticky lg:top-24">
        <p className="text-3xl leading-none">{fmtCzk(p.pricePerM2)}<span className="text-base text-muted"> / m²</span></p>
        <p className="text-sm text-ink-soft mt-2">{fmtCzk(p.pricePerPack)} za balení ({fmtNum2(p.m2PerPack)} m²)</p>
        <p className={`text-sm mt-1 ${inStock ? "text-ok" : "text-danger"}`}>{inStock ? `Skladem ${fmtInt(p.stockM2)} m² · u vás do ${p.deliveryDays} prac. dnů` : "Momentálně nedostupné"}</p>

        {/* 1) Hlavní akce */}
        <div ref={ctaRef} className="mt-4">
          <ProductCalcLink product={p} className="btn btn-accent btn-lg w-full"><Ruler className="h-5 w-5" /> Spočítat cenu</ProductCalcLink>
          <p className="text-xs text-muted mt-1.5 text-center">Na vaše metry: balení, podložka, lišty i doprava.</p>
        </div>

        {/* 3) Vedlejší akce — menší, bez barvy */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <TryInRoom className="btn-outline btn-sm w-full !px-2"><Cube className="h-4 w-4 shrink-0" /> Byt ve 3D</TryInRoom>
          <SampleButton productId={p.id} max={settings.samples.max} size="sm" compact className="w-full [&>button]:w-full [&>button]:!px-2" />
        </div>
        <Link href={`/montaz?product=${p.slug}`} className="mt-1 flex items-center justify-center gap-1.5 h-11 text-sm text-ink-soft hover:text-ink"><Hammer className="h-4 w-4" /> Poptat pokládku</Link>

        <div className="divider my-4" />

        {/* 2) Rovnou do košíku: plocha → balení s 5% prořezem */}
        <p className="label">Koupit rovnou</p>
        <label className="text-sm text-ink-soft" htmlFor="area">Plocha místnosti</label>
        <div className="relative mt-1">
          <input id="area" inputMode="decimal" enterKeyHint="done" className="input pr-12" placeholder="např. 18,5" value={area} onChange={(e) => { setArea(e.target.value); setPacksManual(null); }} />
          <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-muted">m²</span>
        </div>
        {quick.packs > 0
          ? <p className="text-sm text-ink-soft mt-2"><strong className="font-normal text-ink">{quick.packs} balení</strong> = {fmtNum2(quick.coveredM2)} m² (s 5% prořezem)</p>
          : noArea && <p className="text-sm text-muted mt-2">Bez plochy přidáte 1 balení ({fmtNum2(p.m2PerPack)} m²).</p>}

        {/* Na úzkém telefonu jde celková cena na vlastní řádek — velké částky jinak přetékají z boxu. */}
        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
          <div className="inline-flex items-center border border-line-strong rounded-sm bg-white">
            <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Méně balení" onClick={() => setPacksManual(Math.max(1, packs - 1))}><Minus className="h-4 w-4" /></button>
            <span className="w-10 text-center tabular-nums" aria-live="polite">{packs}</span>
            <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Více balení" onClick={() => setPacksManual(packs + 1)}><Plus className="h-4 w-4" /></button>
          </div>
          <div className="text-sm text-muted leading-tight min-w-0">bal. = <span className="text-ink whitespace-nowrap">{fmtNum2(m2)} m²</span></div>
          <div className="basis-full sm:basis-auto sm:ml-auto min-w-0 flex items-baseline justify-between gap-2">
            <span className="text-sm text-muted sm:hidden">Celkem</span>
            <span className="text-xl tabular-nums break-words">{fmtCzk(total)}</span>
          </div>
        </div>
        {overStock && <p className="notice notice-warn mt-3 text-sm">Skladem je {fmtInt(p.stockM2)} m². Zbytek doobjednáme u výrobce a ozveme se s termínem.</p>}

        <p className="mt-3 text-sm text-ink-soft flex items-start gap-2">
          <Truck className="h-4 w-4 shrink-0 mt-0.5" />
          <span>Doprava {ship.free ? <strong className="font-normal text-ok">zdarma</strong> : fmtCzk(ship.price)}{ship.method === "pallet" ? " · paleta ke krajnici (vynášku nabídneme v košíku)" : ""}{!ship.free && ` · zdarma od ${settings.freeShippingFromM2} m²`}</span>
        </p>

        <div className="mt-4 grid gap-2">
          <button type="button" className="btn btn-primary w-full" disabled={!inStock} onClick={addToCart}>
            {flash ? <><Check className="h-5 w-5" /> Přidáno do košíku</> : <>Do košíku · {packs} bal. <span className="text-white/70">({fmtNum2(m2)} m²)</span></>}
          </button>
          {added && <Link href="/kosik" className="btn btn-outline w-full">Přejít do košíku <ArrowRight className="h-4 w-4" /></Link>}
        </div>
      </div>

      {/* Spodní lišta na telefonu: cena a hlavní akce, kdykoli hlavní tlačítko v boxu není vidět */}
      <div className={`lg:hidden fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)] transition-transform duration-300 ${ctaVisible ? "translate-y-[calc(100%_+_var(--cookie-h,0px))]" : "translate-y-0"}`} aria-hidden={ctaVisible}>
        <div className="container py-2 flex items-center gap-2">
          <div className="flex-1 min-w-0 leading-tight">
            <p className="text-lg tabular-nums truncate">{fmtCzk(p.pricePerM2)}<span className="text-xs text-muted"> / m²</span></p>
            <p className="text-xs text-muted truncate">{fmtCzk(p.pricePerPack)} / bal.</p>
          </div>
          <button type="button" tabIndex={ctaVisible ? -1 : undefined} className="btn btn-outline !px-0 w-11 shrink-0" onPointerDown={preloadVisualizer} onClick={openViz} aria-label="Byt ve 3D" title="Byt ve 3D"><Cube className="h-5 w-5" /></button>
          <ProductCalcLink product={p} className="btn btn-accent shrink-0" tabIndex={ctaVisible ? -1 : undefined}><Ruler className="h-4 w-4" /> Spočítat cenu</ProductCalcLink>
        </div>
      </div>
    </>
  );
}
