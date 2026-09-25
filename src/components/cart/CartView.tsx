"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/store/cart";
import { useQuote } from "./useQuote";
import { ShipmentsView } from "./ShipmentsView";
import { fmtCzk, fmtKg, fmtNum2 } from "@/lib/format";
import { Minus, Plus, Trash, Hammer } from "@/components/ui/icons";

export function CartView({ freeFromM2, carryUpParcel, carryUpPalletPerFloor }: { freeFromM2: number; carryUpParcel: number; carryUpPalletPerFloor: number }) {
  const { quote, loading, hydrated } = useQuote();
  const setQty = useCart((s) => s.setQty);
  const remove = useCart((s) => s.remove);
  const carryUp = useCart((s) => s.carryUp);
  const setCarryUp = useCart((s) => s.setCarryUp);
  const installRequested = useCart((s) => s.installRequested);
  const setInstall = useCart((s) => s.setInstallRequested);
  const calculationId = useCart((s) => s.calculationId);

  if (!hydrated || (loading && !quote)) return <div className="panel text-muted">Načítám košík…</div>;
  if (!quote || quote.lines.length === 0) {
    return (
      <div className="panel text-center py-16">
        <p className="h3">Košík je prázdný.</p>
        <p className="text-muted mt-2">Nejrychlejší cesta k plnému košíku je kalkulačka: zadáte místnost, my dopočítáme balení i příslušenství.</p>
        <div className="mt-6 flex justify-center gap-3"><Link href="/kalkulacka" className="btn btn-accent">Spočítat projekt</Link><Link href="/podlahy" className="btn btn-outline">Katalog</Link></div>
      </div>
    );
  }
  const anyPallet = quote.shipments.some((s) => s.method === "pallet");

  return (
    <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
      <div className="lg:col-span-7 space-y-8">
        <ul className="card divide-y divide-line">
          {quote.lines.map((l) => (
            <li key={`${l.kind}-${l.id}`} className="p-3 md:p-4 flex gap-4">
              <div className="relative h-20 w-24 rounded-sm overflow-hidden bg-bg shrink-0">{l.image ? <Image src={l.image} alt="" fill sizes="96px" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-[10px] text-muted">bez fotky</div>}</div>
              <div className="flex-1 min-w-0">
                <p className="leading-tight">{l.kind === "product" ? <Link href={`/podlaha/${l.slug}`} className="hover:underline">{l.name}</Link> : l.name}</p>
                <p className="text-xs text-muted mt-0.5">{l.detail}</p>
                {l.m2 !== null && <p className="text-xs text-muted">= {fmtNum2(l.m2)} m²</p>}
                {l.availabilityNote && <p className="text-xs text-warn mt-1">{l.availabilityNote}</p>}
                <div className="mt-2 flex items-center gap-3 flex-wrap">
                  <div className="inline-flex items-center border border-line-strong rounded-sm bg-white">
                    <button type="button" className="h-9 w-9 grid place-items-center hover:bg-bg" aria-label="Méně" onClick={() => setQty(l.kind, l.id, l.qty - 1)}><Minus className="h-4 w-4" /></button>
                    <span className="w-10 text-center tabular-nums text-sm">{l.qty}</span>
                    <button type="button" className="h-9 w-9 grid place-items-center hover:bg-bg" aria-label="Více" onClick={() => setQty(l.kind, l.id, l.qty + 1)}><Plus className="h-4 w-4" /></button>
                  </div>
                  <span className="text-xs text-muted">{l.unit} · {fmtCzk(l.unitPrice)}/{l.unit}</span>
                  <button type="button" className="ml-auto p-1.5 text-muted hover:text-danger" aria-label="Odebrat" onClick={() => remove(l.kind, l.id)}><Trash className="h-4 w-4" /></button>
                </div>
              </div>
              <div className="text-right shrink-0 tabular-nums">{fmtCzk(l.lineTotal)}</div>
            </li>
          ))}
        </ul>
        {quote.warnings.map((w) => <p key={w} className="notice notice-info text-sm">{w}</p>)}

        <section>
          <h2 className="h3 mb-1">Doprava</h2>
          <p className="text-sm text-muted mb-4">Počítáme z hmotnosti: celkem {fmtKg(quote.totalWeightKg)}, {fmtNum2(quote.totalFloorM2)} m² podlahy. Zdarma od {freeFromM2} m² v zásilce. Dovoz je <strong className="text-ink">ke krajnici / před dům</strong>, ne do bytu.</p>
          <ShipmentsView shipments={quote.shipments} showCarryUp={carryUp.enabled} />
          <div className="card p-4 mt-4">
            <label className="check items-start"><input type="checkbox" className="mt-1" checked={carryUp.enabled} onChange={(e) => setCarryUp({ enabled: e.target.checked })} /><span><strong>Chci vynášku do patra / do bytu</strong><br /><span className="text-sm text-muted">{anyPallet ? `Paleta: ${fmtCzk(carryUpPalletPerFloor)} za každé patro (s výtahem jako 1 patro).` : `Balík: ${fmtCzk(carryUpParcel)} za zásilku.`}</span></span></label>
            {carryUp.enabled && anyPallet && (
              <div className="mt-3 pl-7 flex flex-wrap items-center gap-4 text-sm">
                <label className="inline-flex items-center gap-2">Patro <input type="number" min={0} max={30} className="input !w-20 !py-1.5" value={carryUp.floor} onChange={(e) => setCarryUp({ floor: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} /></label>
                <label className="check"><input type="checkbox" checked={carryUp.elevator} onChange={(e) => setCarryUp({ elevator: e.target.checked })} /> v domě je výtah</label>
              </div>
            )}
          </div>
        </section>

        <section className="card p-4">
          <label className="check items-start"><input type="checkbox" className="mt-1" checked={installRequested} onChange={(e) => setInstall(e.target.checked)} /><span className="inline-flex items-center gap-2"><Hammer className="h-4 w-4" /> <strong>Chci i pokládku</strong></span></label>
          <p className="text-sm text-muted mt-1 pl-7">Po odeslání objednávky vás spojíme s ověřeným podlahářem z vašeho okolí. Cena pokládky se domlouvá zvlášť.</p>
        </section>
      </div>

      <aside className="lg:col-span-5">
        <div className="panel lg:sticky lg:top-24">
          <p className="eyebrow">Souhrn</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt className="text-muted">Zboží</dt><dd className="tabular-nums">{fmtCzk(quote.itemsTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Doprava ({quote.shipments.length} {quote.shipments.length === 1 ? "zásilka" : quote.shipments.length < 5 ? "zásilky" : "zásilek"})</dt><dd className="tabular-nums">{quote.shippingTotal === 0 ? "zdarma" : fmtCzk(quote.shippingTotal)}</dd></div>
            {carryUp.enabled && <div className="flex justify-between"><dt className="text-muted">Vynáška</dt><dd className="tabular-nums">{fmtCzk(quote.carryUpTotal)}</dd></div>}
          </dl>
          <div className="flex justify-between items-baseline border-t border-ink mt-4 pt-4"><span>Celkem vč. DPH</span><span className="text-2xl tabular-nums">{fmtCzk(quote.total)}</span></div>
          <Link href="/pokladna" className="btn btn-accent btn-lg w-full mt-6">Pokračovat k objednávce</Link>
          <p className="text-xs text-muted mt-3">Platba bankovním převodem po potvrzení dostupnosti. Platební kartu připravujeme.</p>
          {calculationId && <p className="text-xs text-muted mt-2">Košík vychází z <Link href={`/kalkulace/${calculationId}`} className="link">uložené kalkulace</Link>.</p>}
          <Link href="/kalkulacka" className="btn btn-ghost w-full mt-3 text-ink-soft">Přidat další místnost přes kalkulačku</Link>
        </div>
      </aside>
    </div>
  );
}
