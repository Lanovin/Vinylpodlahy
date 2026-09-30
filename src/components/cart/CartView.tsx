"use client";
import Image from "next/image";
import Link from "next/link";
import { useCart } from "@/store/cart";
import { useQuote } from "./useQuote";
import { ShipmentsView } from "./ShipmentsView";
import { fmtCzk, fmtNum2 } from "@/lib/format";
import type { CartQuote, Shipment } from "@/lib/types";
import { Minus, Plus, Trash, Hammer, Ruler, Cube } from "@/components/ui/icons";

/**
 * Pobídka k dopravě zdarma: kolik balení podlahy v zásilce chybí do limitu a jestli je doplnění levnější než doprava.
 * Jen zobrazení — ceny i dopravu po přidání znovu spočítá server.
 */
function freeShippingTip(s: Shipment, quote: CartQuote, freeFromM2: number) {
  if (s.freeShipping || s.floorM2 <= 0 || s.price <= 0) return null;
  const missing = Math.round((freeFromM2 - s.floorM2) * 100) / 100;
  if (missing <= 0) return null;
  const floors = quote.lines.filter((l) => l.kind === "product" && l.supplierId === s.supplierId && l.available && l.m2 && l.qty > 0);
  let best: { id: string; name: string; qty: number; packs: number; cost: number } | null = null;
  for (const l of floors) {
    const perPack = l.m2! / l.qty;
    const packs = Math.ceil(missing / perPack - 1e-9);
    const cost = packs * l.unitPrice;
    if (!best || cost < best.cost) best = { id: l.id, name: l.name, qty: l.qty, packs, cost };
  }
  if (!best || best.cost >= s.price) return null;
  return { ...best, missing, saving: s.price, named: floors.length > 1 };
}

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
      <div className="panel text-center py-12 md:py-16">
        <p className="h3">Košík je prázdný.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat projekt</Link><Link href="/vizualizace" className="btn btn-outline"><Cube className="h-4 w-4" /> Vyzkoušet ve 3D</Link></div>
      </div>
    );
  }
  const anyPallet = quote.shipments.some((s) => s.method === "pallet");

  const tipFor = (s: Shipment) => {
    const t = freeShippingTip(s, quote, freeFromM2);
    if (!t) return null;
    return (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-md bg-accent-soft px-3 py-2.5 text-sm">
        <p className="flex-1 min-w-48 leading-snug">Do dopravy zdarma chybí {fmtNum2(t.missing)} m². Přidejte {t.packs} balení{t.named ? ` ${t.name}` : ""} (+{fmtCzk(t.cost)}) a ušetříte {fmtCzk(t.saving)} za dopravu.</p>
        <button type="button" className="btn btn-accent shrink-0 px-3" onClick={() => setQty("product", t.id, t.qty + t.packs)}>+{t.packs} balení</button>
      </div>
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-12 pb-24 lg:pb-0">
      <div className="lg:col-span-7 space-y-8">
        <ul className="card divide-y divide-line">
          {quote.lines.map((l) => (
            <li key={`${l.kind}-${l.id}`} className="p-3 md:p-4 flex gap-3 md:gap-4">
              <div className="relative h-16 w-16 rounded-sm overflow-hidden bg-bg shrink-0">{l.image ? <Image src={l.image} alt="" fill sizes="64px" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-[10px] text-muted">bez fotky</div>}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-1">
                  <p className="flex-1 min-w-0 leading-tight line-clamp-2">{l.kind === "product" ? <Link href={`/podlaha/${l.slug}`} className="hover:underline">{l.name}</Link> : l.name}</p>
                  <button type="button" className="-mt-2 -mr-2 h-10 w-10 grid place-items-center shrink-0 text-muted hover:text-danger" aria-label={`Odebrat ${l.name}`} onClick={() => remove(l.kind, l.id)}><Trash className="h-4 w-4" /></button>
                </div>
                <p className="text-xs text-muted">{l.detail} · {fmtCzk(l.unitPrice)}/{l.unit}</p>
                {l.m2 !== null && <p className="text-xs text-muted">= {fmtNum2(l.m2)} m²</p>}
                {l.availabilityNote && <p className="text-xs text-warn mt-1">{l.availabilityNote}</p>}
                <div className="mt-2 flex items-center gap-3">
                  <div className="inline-flex items-center border border-line-strong rounded-sm bg-white">
                    <button type="button" className="h-10 w-10 grid place-items-center hover:bg-bg" aria-label={`Méně: ${l.name}`} onClick={() => setQty(l.kind, l.id, l.qty - 1)}><Minus className="h-4 w-4" /></button>
                    <span className="w-10 text-center tabular-nums text-sm" aria-live="polite">{l.qty}</span>
                    <button type="button" className="h-10 w-10 grid place-items-center hover:bg-bg" aria-label={`Více: ${l.name}`} onClick={() => setQty(l.kind, l.id, l.qty + 1)}><Plus className="h-4 w-4" /></button>
                  </div>
                  <span className="ml-auto tabular-nums">{fmtCzk(l.lineTotal)}</span>
                </div>
              </div>
            </li>
          ))}
        </ul>
        {quote.warnings.map((w) => <p key={w} className="notice notice-info text-sm">{w}</p>)}

        <section>
          <h2 className="h3 mb-1">Doprava</h2>
          <p className="text-sm text-muted mb-4">Zdarma od {freeFromM2} m² podlahy v zásilce.</p>
          <ShipmentsView shipments={quote.shipments} showCarryUp={carryUp.enabled} extra={tipFor} />
          <div className="card px-4 py-2 mt-4">
            <label className="check w-full min-h-11 py-1"><input type="checkbox" className="h-5 w-5 shrink-0" checked={carryUp.enabled} onChange={(e) => setCarryUp({ enabled: e.target.checked })} /><span><span className="text-muted">Dovážíme ke krajnici.</span> <strong>Chci vynášku do patra</strong> <span className="text-sm text-muted whitespace-nowrap">(+{anyPallet ? `${fmtCzk(carryUpPalletPerFloor)}/patro` : `${fmtCzk(carryUpParcel)} za zásilku`})</span></span></label>
            {carryUp.enabled && anyPallet && (
              <div className="pl-8 pb-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                <label className="check min-h-11"><input type="checkbox" className="h-5 w-5" checked={carryUp.elevator} onChange={(e) => setCarryUp({ elevator: e.target.checked })} /> v domě je výtah</label>
                {!carryUp.elevator && <label className="inline-flex items-center gap-2 min-h-11">Patro <input type="number" inputMode="numeric" min={0} max={30} className="input w-20" value={carryUp.floor} onChange={(e) => setCarryUp({ floor: Math.max(0, parseInt(e.target.value || "0", 10) || 0) })} /></label>}
              </div>
            )}
          </div>
        </section>

        <section className="card px-4 py-2">
          <label className="check w-full min-h-11 py-1"><input type="checkbox" className="h-5 w-5 shrink-0" checked={installRequested} onChange={(e) => setInstall(e.target.checked)} /><span className="inline-flex items-center gap-2"><Hammer className="h-4 w-4" /> <strong>Chci i pokládku</strong></span></label>
          <p className="text-sm text-muted pl-8 pb-2">Podlahář z okolí se vám ozve s cenou.</p>
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
          {calculationId && <p className="text-xs text-muted mt-3">Košík vychází z <Link href={`/kalkulace/${calculationId}`} className="link">uložené kalkulace</Link>.</p>}
          <Link href="/kalkulacka" className="btn btn-ghost w-full mt-3 text-ink-soft">Přidat další místnost přes kalkulačku</Link>
        </div>
      </aside>

      {/* Telefon: cena a pokračování vždy na dosah palce (globální spodní lišta se v košíku nezobrazuje). */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
        <div className="container py-2.5 flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <p className={`text-lg leading-tight tabular-nums ${loading ? "opacity-60" : ""}`}>{fmtCzk(quote.total)}</p>
            <p className="text-xs text-muted truncate">vč. dopravy{carryUp.enabled ? " a vynášky" : ""}</p>
          </div>
          <Link href="/pokladna" className="btn btn-accent">K objednávce</Link>
        </div>
      </div>
    </div>
  );
}
