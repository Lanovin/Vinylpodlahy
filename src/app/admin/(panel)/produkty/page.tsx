import Image from "next/image";
import Link from "next/link";
import { accessories, products, suppliers } from "@/lib/db/repos";
import { Card, PageHead, Status } from "@/components/admin/ui";
import { setAccessoryStatusAction, setProductStatusAction } from "../../actions";
import { fmtCzk, fmtNum2 } from "@/lib/format";
import { FLOOR_TYPE_LABEL } from "@/lib/types";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; status?: string }> }) {
  const { q = "", status = "" } = await searchParams;
  const list = products.all().filter((p) => (!status || p.status === status) && (!q || `${p.brand} ${p.name} ${p.supplierSku}`.toLowerCase().includes(q.toLowerCase())));
  const acc = accessories.all();
  return (
    <>
      <PageHead title={`Produkty (${list.length})`} text="Ceny se počítají z nákupní ceny a marže. Pozastavené produkty se na webu nezobrazují — po skoku ceny je potřeba je ručně schválit.">
        <form className="flex gap-2"><input name="q" className="input !w-56 !py-1.5" placeholder="Hledat…" defaultValue={q} /><select name="status" className="select !w-auto !py-1.5" defaultValue={status}><option value="">vše</option><option value="active">aktivní</option><option value="paused">pozastavené</option><option value="hidden">skryté</option></select><button className="btn btn-outline btn-sm">Filtrovat</button></form>
      </PageHead>
      <Card className="overflow-x-auto !p-0">
        <table className="admin-table"><thead><tr><th></th><th>Produkt</th><th>Dodavatel / SKU</th><th>Typ</th><th>Nákup /m²</th><th>Marže</th><th>Prodej /m²</th><th>/ balení</th><th>Sklad m²</th><th>Stav</th><th></th></tr></thead><tbody>
          {list.map((p) => (
            <tr key={p.id}>
              <td><div className="relative h-10 w-14 rounded-sm overflow-hidden bg-bg">{p.images.card && <Image src={p.images.card} alt="" fill sizes="56px" className="object-cover" />}</div></td>
              <td><Link href={`/admin/produkty/${p.id}`} className="link">{p.brand} {p.name}</Link>{p.pauseReason && <p className="text-xs text-warn mt-0.5 max-w-xs">{p.pauseReason}</p>}</td>
              <td className="text-muted text-xs">{suppliers.byId(p.supplierId)?.name}<br />{p.supplierSku}</td>
              <td className="text-xs">{FLOOR_TYPE_LABEL[p.type]}</td>
              <td className="tabular-nums">{fmtCzk(p.purchasePriceM2)}</td>
              <td className="tabular-nums">{p.marginPct} %{p.marginOverridePct !== null && <span className="text-xs text-accent"> ručně</span>}</td>
              <td className="tabular-nums">{fmtCzk(p.pricePerM2)}</td>
              <td className="tabular-nums text-muted">{fmtCzk(p.pricePerPack)}</td>
              <td className="tabular-nums">{fmtNum2(p.stockM2)}<span className="text-xs text-muted"> / {fmtNum2(p.stockM2Raw)}</span></td>
              <td><Status value={p.status} /></td>
              <td>
                <form action={setProductStatusAction} className="flex gap-1"><input type="hidden" name="id" value={p.id} />
                  {p.status !== "active" && <button name="status" value="active" className="btn btn-primary btn-sm !h-7 !px-2 text-xs">Schválit</button>}
                  {p.status === "active" && <button name="status" value="paused" className="btn btn-outline btn-sm !h-7 !px-2 text-xs">Pozastavit</button>}
                </form>
              </td>
            </tr>
          ))}
        </tbody></table>
      </Card>
      <h2 className="text-lg mt-8 mb-3">Příslušenství ({acc.length})</h2>
      <Card className="overflow-x-auto !p-0">
        <table className="admin-table"><thead><tr><th>Název</th><th>Druh</th><th>Dodavatel</th><th>Pokrytí</th><th>Nákup</th><th>Marže</th><th>Prodej</th><th>Sklad</th><th>Stav</th><th></th></tr></thead><tbody>
          {acc.map((a) => <tr key={a.id}><td>{a.name}</td><td className="text-xs">{a.kind}</td><td className="text-xs text-muted">{suppliers.byId(a.supplierId)?.name}</td><td className="text-xs">{a.coverageLabel}</td><td className="tabular-nums">{fmtCzk(a.purchasePrice)}</td><td>{a.marginPct} %</td><td className="tabular-nums">{fmtCzk(a.pricePerUnit)}</td><td>{a.stockUnits} {a.unit}</td><td><Status value={a.status} /></td>
            <td><form action={setAccessoryStatusAction}><input type="hidden" name="id" value={a.id} />{a.status !== "active" ? <button name="status" value="active" className="btn btn-primary btn-sm !h-7 !px-2 text-xs">Aktivovat</button> : <button name="status" value="paused" className="btn btn-outline btn-sm !h-7 !px-2 text-xs">Pozastavit</button>}</form></td></tr>)}
        </tbody></table>
      </Card>
    </>
  );
}
