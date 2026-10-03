import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { carryUpText } from "@/components/cart/ShipmentsView";
import { orders } from "@/lib/db/repos";
import { fmtCzk } from "@/lib/format";
import { Check, Cube, Package, Ruler, Truck } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Objednávka přijata", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = orders.byId(id);
  if (!o) notFound();
  const pallet = o.quote.shipments.some((s) => s.method === "pallet");
  const floor = o.quote.lines.find((l) => l.kind === "product");
  return (
    <Site>
      <div className="container py-8 md:py-14 grid lg:grid-cols-12 gap-8 lg:gap-10">
        <div className="lg:col-span-7">
          <div className="flex items-center gap-3">
            <span className="h-11 w-11 shrink-0 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-6 w-6" /></span>
            <h1 className="h2">Děkujeme, objednávku máme.</h1>
          </div>
          <p className="mt-3 text-ink-soft">Objednávka č. {o.number} · K úhradě <strong className="text-ink tabular-nums">{fmtCzk(o.quote.total)}</strong></p>
          <p className="mt-4 text-ink-soft">Do 1 pracovního dne pošleme na <strong className="text-ink break-all">{o.customer.email}</strong> potvrzení s platebními údaji. Zboží odešleme po připsání platby.</p>
          {o.installRequested && <p className="notice notice-info mt-4">Pokládka: podlahář z okolí PSČ {o.customer.zip} se vám ozve s cenou.</p>}

          <h2 className="h3 mt-8 mb-3">Zásilky</h2>
          <ul className="card divide-y divide-line text-sm">
            {o.quote.shipments.map((s) => (
              <li key={s.supplierId} className="px-4 py-3 flex items-center gap-3">
                {s.method === "pallet" ? <Truck className="h-5 w-5 shrink-0 text-muted" /> : <Package className="h-5 w-5 shrink-0 text-muted" />}
                <span className="flex-1 min-w-0">{s.methodLabel} · {s.deliveryLabel}</span>
                <span className={`tabular-nums shrink-0 ${s.freeShipping ? "text-ok" : ""}`}>{s.freeShipping ? "zdarma" : fmtCzk(s.price)}</span>
              </li>
            ))}
          </ul>
          <p className="text-sm text-muted mt-3">{o.carryUp.enabled ? carryUpText(o.carryUp, pallet) : "Dovoz ke krajnici."} Řidič vám zavolá na {o.customer.phone}.</p>

          <div className="mt-8 grid sm:flex sm:flex-wrap gap-3">
            <Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat cenu další místnosti</Link>
            <Link href={floor ? `/vizualizace?podlaha=${encodeURIComponent(floor.slug)}` : "/vizualizace"} className="btn btn-outline"><Cube className="h-4 w-4" /> Byt ve 3D</Link>
          </div>
          {o.calculationId && <Link href={`/kalkulace/${o.calculationId}`} className="mt-2 inline-flex items-center min-h-11 text-sm link">Zobrazit kalkulaci</Link>}
        </div>
        <aside className="lg:col-span-5">
          <div className="panel">
            <p className="eyebrow">Rekapitulace</p>
            <ul className="mt-4 divide-y divide-line text-sm">{o.quote.lines.map((l) => <li key={`${l.kind}-${l.id}`} className="py-2 flex justify-between gap-3"><span className="min-w-0">{l.qty}× {l.name}</span><span className="tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</span></li>)}</ul>
            <dl className="mt-3 space-y-1.5 text-sm border-t border-line pt-3">
              <div className="flex justify-between"><dt className="text-muted">Zboží</dt><dd>{fmtCzk(o.quote.itemsTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Doprava</dt><dd>{o.quote.shippingTotal === 0 ? "zdarma" : fmtCzk(o.quote.shippingTotal)}</dd></div>
              {o.quote.carryUpTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Vynáška</dt><dd>{fmtCzk(o.quote.carryUpTotal)}</dd></div>}
            </dl>
            <div className="flex justify-between items-baseline border-t border-ink mt-3 pt-3"><span>Celkem vč. DPH</span><span className="text-2xl">{fmtCzk(o.quote.total)}</span></div>
            <p className="text-sm text-muted mt-4">{o.customer.name}<br />{o.customer.street}<br />{o.customer.zip} {o.customer.city}</p>
            {o.customer.business && <p className="text-sm text-muted mt-2">{o.customer.business.company}<br />IČO {o.customer.business.ico}{o.customer.business.dic ? ` · DIČ ${o.customer.business.dic}` : ""}</p>}
          </div>
        </aside>
      </div>
    </Site>
  );
}
