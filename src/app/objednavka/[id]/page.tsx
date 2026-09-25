import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { ShipmentsView } from "@/components/cart/ShipmentsView";
import { orders } from "@/lib/db/repos";
import { fmtCzk, fmtDate } from "@/lib/format";
import { Check } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata = { title: "Objednávka přijata", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = orders.byId(id);
  if (!o) notFound();
  return (
    <Site>
      <div className="container py-16 md:py-20 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-7">
          <span className="h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
          <p className="eyebrow mt-6">Objednávka č. {o.number} · {fmtDate(o.createdAt)}</p>
          <h1 className="h2 mt-2">Děkujeme, objednávku máme.</h1>
          <p className="lead mt-4">Do 1 pracovního dne ověříme dostupnost u {o.quote.shipments.length === 1 ? "dodavatele" : `${o.quote.shipments.length} dodavatelů`} a pošleme na <strong>{o.customer.email}</strong> potvrzení s platebními údaji. Zboží se expeduje po připsání platby.</p>
          {o.installRequested && <p className="notice notice-info mt-6">Zájem o pokládku jsme zaznamenali — ozve se vám podlahář z okolí PSČ {o.customer.zip}.</p>}
          <h2 className="h3 mt-10 mb-4">Zásilky</h2>
          <ShipmentsView shipments={o.quote.shipments} showCarryUp={o.carryUp.enabled} />
          <p className="text-sm text-muted mt-4">Dovoz je ke krajnici / před dům.{o.carryUp.enabled ? ` Vynáška objednána (${o.carryUp.elevator ? "s výtahem" : `${o.carryUp.floor}. patro`}).` : ""} Řidič vám zavolá na {o.customer.phone}.</p>
          <div className="mt-8 flex gap-3"><Link href="/" className="btn btn-outline">Zpět na úvod</Link>{o.calculationId && <Link href={`/kalkulace/${o.calculationId}`} className="btn btn-ghost">Zobrazit kalkulaci</Link>}</div>
        </div>
        <aside className="lg:col-span-5">
          <div className="panel">
            <p className="eyebrow">Rekapitulace</p>
            <ul className="mt-4 divide-y divide-line text-sm">{o.quote.lines.map((l) => <li key={`${l.kind}-${l.id}`} className="py-2 flex justify-between gap-3"><span>{l.qty}× {l.name}</span><span className="tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</span></li>)}</ul>
            <dl className="mt-3 space-y-1.5 text-sm border-t border-line pt-3">
              <div className="flex justify-between"><dt className="text-muted">Zboží</dt><dd>{fmtCzk(o.quote.itemsTotal)}</dd></div>
              <div className="flex justify-between"><dt className="text-muted">Doprava</dt><dd>{o.quote.shippingTotal === 0 ? "zdarma" : fmtCzk(o.quote.shippingTotal)}</dd></div>
              {o.quote.carryUpTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Vynáška</dt><dd>{fmtCzk(o.quote.carryUpTotal)}</dd></div>}
            </dl>
            <div className="flex justify-between items-baseline border-t border-ink mt-3 pt-3"><span>Celkem vč. DPH</span><span className="text-2xl">{fmtCzk(o.quote.total)}</span></div>
            <p className="text-sm text-muted mt-4">{o.customer.name}<br />{o.customer.street}<br />{o.customer.zip} {o.customer.city}</p>
          </div>
        </aside>
      </div>
    </Site>
  );
}
