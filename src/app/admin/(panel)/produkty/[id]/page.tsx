import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { pricingRules, products, settings, suppliers } from "@/lib/db/repos";
import { Card, PageHead, Saved, Status } from "@/components/admin/ui";
import { saveProductAction } from "../../../actions";
import { fmtCzk, fmtDate, fmtNum2 } from "@/lib/format";
import { resolveMargin, sellPrice } from "@/lib/pricing";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";

export default async function Page({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ saved?: string }> }) {
  const { id } = await params; const { saved } = await searchParams;
  const p = products.byId(id);
  if (!p) notFound();
  const cfg = settings.get();
  const ruleMargin = resolveMargin(pricingRules.all(), p.supplierId, "floor", null);
  return (
    <>
      <PageHead title={`${p.brand} ${p.name}`} text={`${suppliers.byId(p.supplierId)?.name} · SKU ${p.supplierSku} · aktualizováno ${fmtDate(p.updatedAt)}`}><Link href={`/podlaha/${p.slug}`} className="btn btn-outline btn-sm" target="_blank">Zobrazit na webu</Link></PageHead>
      <Saved show={!!saved} />
      {p.pauseReason && <p className="notice notice-warn text-sm mb-4">{p.pauseReason}</p>}
      <div className="grid lg:grid-cols-3 gap-4">
        <form action={saveProductAction} className="lg:col-span-2 space-y-4">
          <input type="hidden" name="id" value={p.id} />
          <Card><h2 className="text-lg mb-4">Texty a zařazení</h2><div className="grid md:grid-cols-2 gap-4">
            <div><label className="label">Název</label><input name="name" className="input" defaultValue={p.name} /></div>
            <div><label className="label">Dekor</label><input name="decor" className="input" defaultValue={p.decor} /></div>
            <div><label className="label">Odstín (průvodce, filtry)</label><select name="decorTone" className="select" defaultValue={p.decorTone}>{Object.entries(DECOR_TONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
            <div><label className="label">Stav</label><select name="status" className="select" defaultValue={p.status}><option value="active">aktivní</option><option value="paused">pozastaveno</option><option value="hidden">skryto</option></select></div>
            <div className="md:col-span-2"><label className="label">Popis</label><textarea name="description" className="textarea" rows={4} defaultValue={p.description} /></div>
            <label className="check text-sm"><input type="checkbox" name="isNew" defaultChecked={p.isNew} /> označit jako novinku</label>
          </div></Card>
          <Card><h2 className="text-lg mb-1">Cena</h2><p className="text-sm text-muted mb-4">Nákupní cena {fmtCzk(p.purchasePriceM2)}/m² bez DPH (z feedu). Marže z pravidel: {ruleMargin} % → {fmtCzk(sellPrice(p.purchasePriceM2, ruleMargin, cfg.vatRate))}/m². Ruční přepis má přednost.</p>
            <div className="grid md:grid-cols-3 gap-4 items-end">
              <div><label className="label">Ruční marže % (prázdné = z pravidel)</label><input name="marginOverridePct" className="input" defaultValue={p.marginOverridePct ?? ""} placeholder={String(ruleMargin)} /></div>
              <div><p className="label">Aktuální prodejní cena</p><p className="text-xl">{fmtCzk(p.pricePerM2)}/m²</p><p className="text-xs text-muted">{fmtCzk(p.pricePerPack)} / balení</p></div>
              <button className="btn btn-primary">Uložit a přepočítat</button>
            </div></Card>
        </form>
        <div className="space-y-4">
          <Card>{p.images.card && <div className="relative aspect-[4/3] rounded overflow-hidden mb-3"><Image src={p.images.card} alt="" fill sizes="400px" className="object-cover" /></div>}
            <p className="text-xs text-muted">Zdroj: {p.images.sources.texture.url}</p></Card>
          <Card><h2 className="text-lg mb-3">Parametry z feedu</h2><table className="spec text-sm"><tbody>
            <tr><th>Stav</th><td><Status value={p.status} /></td></tr><tr><th>Typ</th><td>{FLOOR_TYPE_LABEL[p.type]} · {LOCK_LABEL[p.lock]}</td></tr><tr><th>Tloušťka / nášlap</th><td>{p.thicknessMm} / {p.wearLayerMm} mm</td></tr><tr><th>Třída</th><td>{p.usageClass}</td></tr><tr><th>Balení</th><td>{fmtNum2(p.m2PerPack)} m² · {p.packWeightKg} kg{p.weightEstimated && " (odhad)"}</td></tr><tr><th>Sklad</th><td>{fmtNum2(p.stockM2Raw)} m² → prodejné {fmtNum2(p.stockM2)} m²</td></tr><tr><th>Dodání</th><td>{p.deliveryDays} dní</td></tr><tr><th>Topení / podložka</th><td>{p.floorHeating ? "ano" : "ne"} / {p.integratedUnderlay ? "ano" : "ne"}</td></tr>
          </tbody></table></Card>
        </div>
      </div>
    </>
  );
}
