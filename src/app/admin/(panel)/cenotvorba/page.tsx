import { pricingRules, suppliers } from "@/lib/db/repos";
import { Card, PageHead } from "@/components/admin/ui";
import { deletePricingRuleAction, savePricingRuleAction } from "../../actions";

export default function Page() {
  const rules = pricingRules.all();
  const sups = suppliers.all();
  return (
    <>
      <PageHead title="Cenotvorba" text="Marže se řeší od nejkonkrétnějšího pravidla: dodavatel + kategorie → dodavatel → kategorie → globální. Příslušenství má vyšší marži než podlaha. Prodejní cena = nákup × (1 + marže) × 1,21, zaokrouhleno na Kč." />
      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2 !p-0 overflow-x-auto">
          <table className="admin-table"><thead><tr><th>Dodavatel</th><th>Kategorie</th><th>Marže</th><th>Poznámka</th><th></th></tr></thead><tbody>
            {rules.sort((a, b) => (a.supplierId ?? "").localeCompare(b.supplierId ?? "") || (a.category ?? "").localeCompare(b.category ?? "")).map((r) => (
              <tr key={r.id}><td>{r.supplierId ? sups.find((s) => s.id === r.supplierId)?.name : <span className="text-muted">všichni</span>}</td><td>{r.category === "floor" ? "podlahy" : r.category === "accessory" ? "příslušenství" : <span className="text-muted">vše</span>}</td>
                <td><form action={savePricingRuleAction} className="flex gap-1 items-center"><input type="hidden" name="id" value={r.id} /><input type="hidden" name="supplierId" value={r.supplierId ?? ""} /><input type="hidden" name="category" value={r.category ?? ""} /><input type="hidden" name="note" value={r.note} /><input name="marginPct" className="input !w-20 !py-1" defaultValue={r.marginPct} /> %<button className="btn btn-ghost btn-sm !h-7 !px-2 text-xs">Uložit</button></form></td>
                <td className="text-xs text-muted">{r.note}</td>
                <td><form action={deletePricingRuleAction}><input type="hidden" name="id" value={r.id} /><button className="text-xs text-muted hover:text-danger">smazat</button></form></td></tr>
            ))}
          </tbody></table>
        </Card>
        <Card>
          <h2 className="text-lg mb-3">Nové pravidlo</h2>
          <form action={savePricingRuleAction} className="space-y-3">
            <div><label className="label">Dodavatel</label><select name="supplierId" className="select"><option value="">všichni</option>{sups.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="label">Kategorie</label><select name="category" className="select"><option value="">vše</option><option value="floor">podlahy</option><option value="accessory">příslušenství</option></select></div>
            <div><label className="label">Marže %</label><input name="marginPct" className="input" placeholder="30" required /></div>
            <div><label className="label">Poznámka</label><input name="note" className="input" /></div>
            <button className="btn btn-primary w-full">Přidat a přepočítat ceny</button>
          </form>
        </Card>
      </div>
    </>
  );
}
