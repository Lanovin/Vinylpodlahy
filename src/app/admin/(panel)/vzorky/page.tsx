import Link from "next/link";
import { emailQueue, products, sampleRequests } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { markEmailSentAction, setSampleStatusAction } from "../../actions";
import { fmtDate } from "@/lib/format";

const EMAIL_LABEL = { "sample-confirm": "D+0 potvrzení", "sample-reminder-calc": "D+3 připomínka + kalkulace", "sample-discount": "D+7 sleva", "calc-share": "Kalkulace na e-mail" } as const;

export default function Page() {
  const reqs = sampleRequests.all();
  const q = emailQueue.all().sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const due = q.filter((e) => !e.sentAt);
  return (
    <>
      <PageHead title={`Žádosti o vzorky (${reqs.length})`} text="Vzorkovnice je akviziční nástroj: kontakt + vybrané dekory + navazující e-maily D+0 / D+3 / D+7. Fronta čeká na napojení odesílače (SMTP / Ecomail); zatím se odbavuje ručně." />
      <Card className="!p-0 overflow-x-auto"><table className="admin-table"><thead><tr><th>Kdy</th><th>Kontakt</th><th>Adresa</th><th>Dekory</th><th>Kalkulace</th><th>Stav</th><th></th></tr></thead><tbody>
        {reqs.map((r) => <tr key={r.id}><td className="text-xs text-muted whitespace-nowrap">{fmtDate(r.createdAt)}</td><td>{r.name}<br /><a href={`mailto:${r.email}`} className="text-xs link">{r.email}</a>{r.phone && <span className="text-xs text-muted"> · {r.phone}</span>}</td><td className="text-xs">{r.street}<br />{r.zip} {r.city}</td>
          <td className="text-xs">{r.productIds.map((id) => { const p = products.byId(id); return <div key={id}>{p ? `${p.brand} ${p.name}` : id}</div>; })}</td>
          <td className="text-xs">{r.calculationId ? <Link href={`/kalkulace/${r.calculationId}`} className="link" target="_blank">otevřít</Link> : "—"}</td><td><Status value={r.status} /></td>
          <td><form action={setSampleStatusAction} className="flex gap-1"><input type="hidden" name="id" value={r.id} />{r.status === "new" && <button name="status" value="sent" className="btn btn-outline btn-sm !h-7 !px-2 text-xs">Odesláno</button>}{r.status !== "done" && <button name="status" value="done" className="btn btn-ghost btn-sm !h-7 !px-2 text-xs">Hotovo</button>}</form></td></tr>)}
        {reqs.length === 0 && <tr><td colSpan={7} className="text-muted">Zatím žádná žádost.</td></tr>}
      </tbody></table></Card>
      <h2 className="text-lg mt-8 mb-3">E-mailová fronta — čeká {due.length}</h2>
      <Card className="!p-0 overflow-x-auto"><table className="admin-table"><thead><tr><th>Odeslat</th><th>Komu</th><th>Typ</th><th>Obsah</th><th>Stav</th><th></th></tr></thead><tbody>
        {q.slice(0, 60).map((e) => { const overdue = !e.sentAt && e.dueAt <= new Date().toISOString(); return (
          <tr key={e.id}><td className={`text-xs whitespace-nowrap ${overdue ? "text-danger" : "text-muted"}`}>{fmtDate(e.dueAt)}</td><td className="text-xs">{e.to}</td><td className="text-xs">{EMAIL_LABEL[e.type]}</td><td className="text-xs text-muted max-w-xs">{(e.payload.decors as string[] | undefined)?.join(", ")}{e.type === "sample-discount" && ` · kód ${String(e.payload.code)} (−${String(e.payload.discountPct)} %)`}{e.type === "sample-reminder-calc" && e.payload.calculationId ? ` · kalkulace ${String(e.payload.calculationId)}` : ""}</td>
            <td>{e.sentAt ? <Status value="sent" /> : overdue ? <span className="text-xs text-danger">k odeslání</span> : <span className="text-xs text-muted">naplánováno</span>}</td>
            <td>{!e.sentAt && <form action={markEmailSentAction}><input type="hidden" name="id" value={e.id} /><button className="btn btn-ghost btn-sm !h-7 !px-2 text-xs">Označit odeslané</button></form>}</td></tr>); })}
        {q.length === 0 && <tr><td colSpan={6} className="text-muted">Fronta je prázdná.</td></tr>}
      </tbody></table></Card>
    </>
  );
}
