"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { PublicProduct, PublicSettings } from "@/lib/public";
import { quickPacks } from "@/lib/calc";
import { estimateProductShipping } from "@/lib/shipping";
import { fmtCzk, fmtKg, fmtNum2 } from "@/lib/format";
import { useCart } from "@/store/cart";
import { SampleButton } from "./SampleButton";
import { Hammer, Info, Minus, Plus, Ruler, Truck } from "@/components/ui/icons";

export function BuyBox({ p, settings }: { p: PublicProduct; settings: PublicSettings }) {
  const [area, setArea] = useState<string>("");
  const [packsManual, setPacksManual] = useState<number | null>(null);
  const add = useCart((s) => s.add);
  const router = useRouter();
  const [added, setAdded] = useState(false);

  const areaNum = parseFloat(area.replace(",", "."));
  const quick = useMemo(() => quickPacks(p, Number.isFinite(areaNum) ? areaNum : 0), [p, areaNum]);
  const packs = packsManual ?? (quick.packs || 1);
  const total = packs * p.pricePerPack;
  const ship = useMemo(() => estimateProductShipping(p, packs, settings), [p, packs, settings]);
  const m2 = packs * p.m2PerPack;
  const overStock = m2 > p.stockM2;

  return (
    <div className="panel sticky top-24">
      <div className="flex items-baseline justify-between gap-4 flex-wrap">
        <div>
          <p className="text-3xl leading-none">{fmtCzk(p.pricePerM2)}<span className="text-base text-muted"> / m²</span></p>
          <p className="text-muted mt-1.5">{fmtCzk(p.pricePerPack)} / balení · {fmtNum2(p.m2PerPack)} m² v balení</p>
        </div>
        <div className="text-right text-sm">
          <p className={p.stockM2 > 0 ? "text-ok" : "text-danger"}>{p.stockM2 > 0 ? `${fmtNum2(p.stockM2)} m² dostupných` : "Momentálně 0 m²"}</p>
          <p className="text-muted">dodání do {p.deliveryDays} pracovních dní</p>
        </div>
      </div>
      <p className="text-xs text-muted mt-3 flex gap-1.5"><Info className="h-4 w-4 shrink-0" /> Prodáváme po celých baleních. Cena za m² slouží k porovnání; platíte cenu za balení.</p>

      <div className="divider my-5" />

      {/* Mini-kalkulačka */}
      <label className="label" htmlFor="area">Plocha místnosti (m²)</label>
      <div className="flex gap-2">
        <input id="area" inputMode="decimal" className="input" placeholder="např. 18,5" value={area} onChange={(e) => { setArea(e.target.value); setPacksManual(null); }} />
        <span className="btn btn-ghost pointer-events-none shrink-0"><Ruler className="h-4 w-4" /> +5 % prořez</span>
      </div>
      {quick.packs > 0 && (
        <p className="text-sm text-ink-soft mt-2">Na {fmtNum2(areaNum)} m² s prořezem ({fmtNum2(quick.areaWithWaste)} m²) potřebujete <strong>{quick.packs} balení</strong> = {fmtNum2(quick.coveredM2)} m². Diagonální pokládka nebo rybí kost? Použijte <Link href={`/kalkulacka?product=${p.slug}`} className="link">kalkulačku projektu</Link>.</p>
      )}

      <div className="mt-5 flex items-center gap-3">
        <div className="inline-flex items-center border border-line-strong rounded-sm bg-white">
          <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Méně" onClick={() => setPacksManual(Math.max(1, packs - 1))}><Minus className="h-4 w-4" /></button>
          <span className="w-14 text-center tabular-nums">{packs}</span>
          <button type="button" className="h-11 w-11 grid place-items-center hover:bg-bg" aria-label="Více" onClick={() => setPacksManual(packs + 1)}><Plus className="h-4 w-4" /></button>
        </div>
        <div className="text-sm text-muted">balení = <strong className="text-ink">{fmtNum2(m2)} m²</strong></div>
        <div className="ml-auto text-xl">{fmtCzk(total)}</div>
      </div>
      {overStock && <p className="notice notice-warn mt-3 text-sm">Dostupných je {fmtNum2(p.stockM2)} m². Objednávku přijmeme, zbytek doobjednáme u výrobce s delší lhůtou a ozveme se s termínem.</p>}

      {/* Odhad dopravy */}
      <div className="mt-4 rounded-md bg-bg p-3.5 text-sm">
        <p className="flex items-center gap-2"><Truck className="h-4 w-4" /> <strong>Doprava: {ship.free ? "zdarma" : fmtCzk(ship.price)}</strong> <span className="text-muted">· {ship.methodLabel} · {fmtKg(ship.weightKg)}{ship.estimated ? " (odhad)" : ""}</span></p>
        <p className="text-muted mt-1.5 leading-snug">
          {ship.method === "pallet" ? "Paleta — řidič ji složí ke krajnici / před dům, ne do bytu. Vynášku do patra nabídneme v košíku." : "Balík ke dveřím domu."}
          {!ship.free && <> Doprava zdarma od {settings.freeShippingFromM2} m² podlahy v zásilce.</>}
        </p>
      </div>

      <div className="mt-5 grid gap-2">
        <button type="button" className="btn btn-accent btn-lg w-full" disabled={p.stockM2 <= 0} onClick={() => { add({ kind: "product", id: p.id, qty: packs }); setAdded(true); setTimeout(() => setAdded(false), 2500); }}>
          {added ? "Přidáno do košíku ✓" : `Do košíku · ${packs} balení`}
        </button>
        {added && <button type="button" className="btn btn-outline w-full" onClick={() => router.push("/kosik")}>Přejít do košíku</button>}
        <Link href={`/kalkulacka?product=${p.slug}`} className="btn btn-outline w-full"><Ruler className="h-4 w-4" /> Spočítat celý projekt s příslušenstvím</Link>
        <SampleButton productId={p.id} max={settings.samples.max} className="w-full [&>button]:w-full" />
        <Link href={`/montaz?product=${p.slug}`} className="btn btn-ghost w-full text-ink-soft"><Hammer className="h-4 w-4" /> Chci i pokládku</Link>
      </div>
    </div>
  );
}
