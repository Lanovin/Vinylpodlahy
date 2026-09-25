import Link from "next/link";
import { calculations } from "@/lib/db/repos";
import { Card, PageHead } from "@/components/admin/ui";
import { fmtCzk, fmtDate, fmtNum2 } from "@/lib/format";

export default function Page() {
  const list = calculations.all().slice(0, 200);
  return (
    <>
      <PageHead title={`Uložené kalkulace (${calculations.all().length})`} text="Každá uložená kalkulace má sdílitelnou URL. Ukazuje, co zákazníci počítají — i když zatím neobjednali." />
      <Card className="!p-0 overflow-x-auto"><table className="admin-table"><thead><tr><th>Kdy</th><th>Podlaha</th><th>Místnosti</th><th>Plocha</th><th>Balení</th><th>Celkem</th><th></th></tr></thead><tbody>
        {list.map((c) => <tr key={c.id}><td className="text-xs text-muted whitespace-nowrap">{fmtDate(c.createdAt)}</td><td>{c.productSnapshot.name}</td><td className="text-xs">{c.result.rooms.map((r) => r.name).join(", ")}</td><td>{fmtNum2(c.result.totalAreaM2)} m²</td><td>{c.result.packs}</td><td className="tabular-nums">{fmtCzk(c.result.total)}</td><td><Link href={`/kalkulace/${c.id}`} target="_blank" className="text-xs link">otevřít</Link></td></tr>)}
        {list.length === 0 && <tr><td colSpan={7} className="text-muted">Zatím žádná kalkulace.</td></tr>}
      </tbody></table></Card>
    </>
  );
}
