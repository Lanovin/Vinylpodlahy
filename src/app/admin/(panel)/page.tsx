import Link from "next/link";
import { alerts, calculations, feedRuns, leads, orders, products, sampleRequests, suppliers } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { acknowledgeAlertAction } from "../actions";
import { fmtCzk, fmtDate } from "@/lib/format";

export default function Dashboard() {
  const open = alerts.open();
  const prods = products.all();
  const os = orders.all();
  const stats = [
    ["Aktivní produkty", prods.filter((p) => p.status === "active").length, `${prods.filter((p) => p.status === "paused").length} pozastaveno`],
    ["Nové objednávky", os.filter((o) => o.status === "new").length, `${fmtCzk(os.reduce((s, o) => s + o.quote.total, 0))} celkem`],
    ["Poptávky montáže", leads.all().filter((l) => l.status === "new").length, `${leads.all().length} celkem`],
    ["Žádosti o vzorky", sampleRequests.all().filter((s) => s.status === "new").length, `${calculations.all().length} uložených kalkulací`],
  ] as const;
  const lastRuns = feedRuns.all().slice(0, 5);
  return (
    <>
      <PageHead title="Přehled" text="Stav obchodu, pipeline a věci, které čekají na vaši reakci." />
      <div className="grid sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {stats.map(([l, v, h]) => <Card key={l}><p className="eyebrow">{l}</p><p className="text-3xl mt-2">{v}</p><p className="text-xs text-muted mt-1">{h}</p></Card>)}
      </div>
      <div className="grid xl:grid-cols-2 gap-4 mt-6">
        <Card>
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg">Upozornění pipeline ({open.length})</h2>{open.length > 0 && <form action={acknowledgeAlertAction}><input type="hidden" name="id" value="all" /><button className="btn btn-ghost btn-sm">Potvrdit vše</button></form>}</div>
          {open.length === 0 ? <p className="text-sm text-muted">Žádná otevřená upozornění. Feedy běží, ceny drží.</p> : (
            <ul className="divide-y divide-line text-sm">
              {open.slice(0, 12).map((a) => (
                <li key={a.id} className="py-2.5 flex gap-3 items-start">
                  <span className={`mt-1 h-2 w-2 rounded-full shrink-0 ${a.type === "feed-failed" || a.type === "price-jump" ? "bg-danger" : a.type === "missing-in-feed" ? "bg-warn" : "bg-sage"}`} />
                  <div className="flex-1 min-w-0"><p>{a.message}</p><p className="text-xs text-muted mt-0.5">{fmtDate(a.createdAt)} · {a.type}{a.productId && <> · <Link href={`/admin/produkty/${a.productId}`} className="link">otevřít produkt</Link></>}</p></div>
                  <form action={acknowledgeAlertAction}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted hover:text-ink">✓</button></form>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card>
          <h2 className="text-lg mb-3">Poslední synchronizace</h2>
          <table className="admin-table"><thead><tr><th>Dodavatel</th><th>Kdy</th><th>Stav</th><th>+ / ~ / −</th></tr></thead><tbody>
            {lastRuns.map((r) => <tr key={r.id}><td>{suppliers.byId(r.supplierId)?.name ?? r.supplierId}</td><td className="text-muted">{fmtDate(r.finishedAt)}</td><td><Status value={r.status} /></td><td className="tabular-nums">{r.stats.added} / {r.stats.updated} / {r.stats.missing}</td></tr>)}
            {lastRuns.length === 0 && <tr><td colSpan={4} className="text-muted">Zatím žádný běh.</td></tr>}
          </tbody></table>
          <Link href="/admin/feedy" className="btn btn-outline btn-sm mt-4">Spravovat feedy</Link>
        </Card>
      </div>
      <Card className="mt-4">
        <h2 className="text-lg mb-3">Poslední objednávky</h2>
        <table className="admin-table"><thead><tr><th>Číslo</th><th>Zákazník</th><th>Položky</th><th>Zásilky</th><th>Celkem</th><th>Stav</th></tr></thead><tbody>
          {os.slice(0, 8).map((o) => <tr key={o.id}><td><Link href="/admin/objednavky" className="link">{o.number}</Link></td><td>{o.customer.name}<br /><span className="text-xs text-muted">{o.customer.city}</span></td><td>{o.quote.lines.length}</td><td>{o.quote.shipments.length}</td><td className="tabular-nums">{fmtCzk(o.quote.total)}</td><td><Status value={o.status} /></td></tr>)}
          {os.length === 0 && <tr><td colSpan={6} className="text-muted">Zatím žádná objednávka.</td></tr>}
        </tbody></table>
      </Card>
    </>
  );
}
