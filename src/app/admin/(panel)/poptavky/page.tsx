import Link from "next/link";
import { leads, products } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { setLeadStatusAction } from "../../actions";
import { fmtDate, fmtNum2 } from "@/lib/format";

export default function Page() {
  const list = leads.all();
  return (
    <>
      <PageHead title={`Poptávky montáže (${list.length})`} text="Leady z karty produktu, kalkulace i košíku („Chci i pokládku“). Každý má vazbu na produkt, kalkulaci nebo objednávku." />
      <Card className="!p-0 overflow-x-auto"><table className="admin-table"><thead><tr><th>Kdy</th><th>Kontakt</th><th>PSČ</th><th>Plocha</th><th>Termín</th><th>Vazba</th><th>Poznámka</th><th>Stav</th><th></th></tr></thead><tbody>
        {list.map((l) => { const p = l.productId ? products.byId(l.productId) : null; return (
          <tr key={l.id}><td className="text-xs text-muted whitespace-nowrap">{fmtDate(l.createdAt)}</td><td>{l.name}<br /><a href={`tel:${l.phone}`} className="text-xs link">{l.phone}</a> · <a href={`mailto:${l.email}`} className="text-xs link">{l.email}</a></td><td>{l.zip}</td><td>{fmtNum2(l.areaM2)} m²</td><td>{l.term}</td>
            <td className="text-xs">{p && <>{p.brand} {p.name}<br /></>}{l.calculationId && <Link href={`/kalkulace/${l.calculationId}`} className="link" target="_blank">kalkulace</Link>} {l.orderId && <span>objednávka</span>} <span className="text-muted">({l.source})</span></td>
            <td className="text-xs text-muted max-w-xs">{l.note}</td><td><Status value={l.status} /></td>
            <td><form action={setLeadStatusAction} className="flex gap-1"><input type="hidden" name="id" value={l.id} />{l.status === "new" && <button name="status" value="contacted" className="btn btn-outline btn-sm !h-7 !px-2 text-xs">Kontaktováno</button>}{l.status !== "closed" && <button name="status" value="closed" className="btn btn-ghost btn-sm !h-7 !px-2 text-xs">Uzavřít</button>}</form></td></tr>); })}
        {list.length === 0 && <tr><td colSpan={9} className="text-muted">Zatím žádná poptávka.</td></tr>}
      </tbody></table></Card>
    </>
  );
}
