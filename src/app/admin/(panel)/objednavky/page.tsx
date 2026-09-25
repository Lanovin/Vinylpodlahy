import Link from "next/link";
import { orders, suppliers } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { setOrderStatusAction } from "../../actions";
import { fmtCzk, fmtDate, fmtKg } from "@/lib/format";

export default function Page() {
  const list = orders.all();
  return (
    <>
      <PageHead title={`Objednávky (${list.length})`} text="Každá objednávka je rozdělená na zásilky podle dodavatele — tak, jak ji dodavatelům předáte. Platební brána zatím není; stav „potvrzeno“ = odeslány platební údaje." />
      <div className="space-y-4">
        {list.map((o) => (
          <Card key={o.id}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div><p className="text-lg">#{o.number} <Status value={o.status} /></p><p className="text-xs text-muted">{fmtDate(o.createdAt)} · {o.customer.name} · {o.customer.street}, {o.customer.zip} {o.customer.city} · <a className="link" href={`tel:${o.customer.phone}`}>{o.customer.phone}</a> · <a className="link" href={`mailto:${o.customer.email}`}>{o.customer.email}</a></p>{o.customer.note && <p className="text-xs mt-1">Poznámka: {o.customer.note}</p>}</div>
              <div className="text-right"><p className="text-xl tabular-nums">{fmtCzk(o.quote.total)}</p><p className="text-xs text-muted">zboží {fmtCzk(o.quote.itemsTotal)} · doprava {fmtCzk(o.quote.shippingTotal)}{o.quote.carryUpTotal > 0 && ` · vynáška ${fmtCzk(o.quote.carryUpTotal)}`}</p></div>
            </div>
            <div className="grid md:grid-cols-2 gap-4 mt-4">
              {o.quote.shipments.map((s) => (
                <div key={s.supplierId} className="rounded bg-bg p-3 text-sm">
                  <p className="font-medium">{suppliers.byId(s.supplierId)?.name ?? s.supplierName} — {s.methodLabel}, {fmtKg(s.weightKg)}, {s.freeShipping ? "doprava zdarma" : fmtCzk(s.price)}{s.carryUpPrice > 0 && `, vynáška ${fmtCzk(s.carryUpPrice)}`}</p>
                  <ul className="mt-1 text-xs text-muted">{s.items.map((it) => <li key={`${it.kind}-${it.id}`}>{it.qty}× {it.name}</li>)}</ul>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-4">
              <form action={setOrderStatusAction} className="flex gap-1 flex-wrap"><input type="hidden" name="id" value={o.id} />
                {(["confirmed", "shipped", "done", "cancelled"] as const).filter((s) => s !== o.status).map((s) => <button key={s} name="status" value={s} className="btn btn-outline btn-sm !h-7 !px-2 text-xs">{{ confirmed: "Potvrdit (odeslat platbu)", shipped: "Expedováno", done: "Hotovo", cancelled: "Zrušit" }[s]}</button>)}
              </form>
              {o.installRequested && <span className="tag tag-accent">chce pokládku</span>}
              {o.carryUp.enabled && <span className="tag">vynáška {o.carryUp.elevator ? "výtah" : `${o.carryUp.floor}. patro`}</span>}
              {o.calculationId && <Link href={`/kalkulace/${o.calculationId}`} target="_blank" className="text-xs link">kalkulace</Link>}
              <Link href={`/objednavka/${o.id}`} target="_blank" className="text-xs link">potvrzení zákazníka</Link>
            </div>
          </Card>
        ))}
        {list.length === 0 && <Card><p className="text-muted">Zatím žádná objednávka.</p></Card>}
      </div>
    </>
  );
}
