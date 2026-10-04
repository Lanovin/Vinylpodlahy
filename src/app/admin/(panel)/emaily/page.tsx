import { emailQueue } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { markEmailSentAction } from "../../actions";
import { fmtDate } from "@/lib/format";

export default function Page() {
  const q = emailQueue.all().sort((a, b) => a.dueAt.localeCompare(b.dueAt));
  const due = q.filter((e) => !e.sentAt);
  return (
    <>
      <PageHead title={`E-mailová fronta (čeká ${due.length})`} text="Kalkulace poslané zákazníkem na e-mail. Fronta čeká na napojení odesílače (SMTP / Ecomail); zatím se odbavuje ručně." />
      <Card className="!p-0 overflow-x-auto"><table className="admin-table"><thead><tr><th>Odeslat</th><th>Komu</th><th>Obsah</th><th>Stav</th><th></th></tr></thead><tbody>
        {q.slice(0, 60).map((e) => { const overdue = !e.sentAt && e.dueAt <= new Date().toISOString(); return (
          <tr key={e.id}><td className={`text-xs whitespace-nowrap ${overdue ? "text-danger" : "text-muted"}`}>{fmtDate(e.dueAt)}</td><td className="text-xs">{e.to}</td><td className="text-xs text-muted max-w-xs">Kalkulace {String(e.payload.calculationId ?? "")}{e.payload.product ? ` · ${String(e.payload.product)}` : ""}</td>
            <td>{e.sentAt ? <Status value="sent" /> : overdue ? <span className="text-xs text-danger">k odeslání</span> : <span className="text-xs text-muted">naplánováno</span>}</td>
            <td>{!e.sentAt && <form action={markEmailSentAction}><input type="hidden" name="id" value={e.id} /><button className="btn btn-ghost btn-sm !h-7 !px-2 text-xs">Označit odeslané</button></form>}</td></tr>); })}
        {q.length === 0 && <tr><td colSpan={5} className="text-muted">Fronta je prázdná.</td></tr>}
      </tbody></table></Card>
    </>
  );
}
