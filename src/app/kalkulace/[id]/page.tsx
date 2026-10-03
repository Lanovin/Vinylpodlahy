import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { CalcResultView } from "@/components/calculator/CalcResultView";
import { SavedCalcActions } from "@/components/calculator/SavedCalcActions";
import { accessories, calculations, products, settings as settingsRepo } from "@/lib/db/repos";
import { calculateProject, projectTotal } from "@/lib/calc";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";
import { LAYOUT_LABEL } from "@/lib/types";
import { fmtCzk, fmtDate, fmtNum2 } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Uložená kalkulace projektu", robots: { index: false } };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const calc = calculations.byId(id);
  if (!calc) notFound();
  const p = products.byId(calc.productId);
  const cfg = settingsRepo.get();
  // Aktuální přepočet: ceny se mohly změnit — ukážeme obojí, prodáváme za aktuální.
  const current = p && p.status === "active" ? calculateProject(toPublicProduct(p), calc.rooms, calc.options, accessories.visible().map(toPublicAccessory), toPublicSettings(cfg)) : null;
  // Starší uložené kalkulace dopravu neobsahují — porovnáváme pak jen zboží, ať změna dopravy nevypadá jako zdražení.
  const before = calc.result.shipping ? projectTotal(calc.result) : calc.result.total;
  const now = current ? (calc.result.shipping ? projectTotal(current) : current.total) : null;
  const priceChanged = current && now !== null && now !== before;

  return (
    <Site>
      <div className="container pt-5 pb-10 md:py-14 grid lg:grid-cols-12 gap-6 lg:gap-12">
        <div className="lg:col-span-7">
          <p className="hidden lg:block eyebrow mb-3">Uložená kalkulace · {fmtDate(calc.createdAt)}</p>
          <h2 className="hidden lg:block h2">{calc.productSnapshot.name}</h2>
          {p?.images.hero && <div className="hidden sm:block relative aspect-[16/9] rounded-md overflow-hidden mt-6"><Image src={p.images.hero} alt="" fill sizes="60vw" className="object-cover" /></div>}
          <h2 className="h3 lg:mt-8 mb-3">Místnosti</h2>
          <table className="spec"><thead><tr><th>Místnost</th><th>Plocha</th><th>Kladení</th><th>Dveře</th></tr></thead><tbody>
            {calc.result.rooms.map((r) => { const src = calc.rooms.find((x) => x.id === r.id); return <tr key={r.id}><td>{r.name}{src?.floorHeating && <span className="tag tag-sage ml-2">topení</span>}</td><td>{fmtNum2(r.areaM2)} m² <span className="text-muted text-xs">(+{r.wastePct} % → {fmtNum2(r.areaWithWasteM2)})</span></td><td>{src ? LAYOUT_LABEL[src.layout] : "—"}</td><td>{r.doors}</td></tr>; })}
          </tbody></table>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href={`/kalkulacka?calc=${calc.id}`} className="btn btn-outline">Upravit kalkulaci</Link>
            {p && <Link href={`/podlaha/${p.slug}`} className="btn btn-ghost">Karta podlahy</Link>}
            <Link href={`/montaz?calc=${calc.id}&area=${calc.result.totalAreaM2}`} className="btn btn-ghost">Poptat pokládku</Link>
          </div>
        </div>
        {/* Na telefonu rozpis s cenou hned pod nadpisem */}
        <div className="lg:col-span-5 max-lg:order-first max-lg:-mt-2">
          <p className="lg:hidden eyebrow mb-2">Uložená kalkulace · {fmtDate(calc.createdAt)}</p>
          <h1 className="lg:hidden h2 mb-4">{calc.productSnapshot.name}</h1>
          <div className="panel">
            <p className="eyebrow">Rozpis</p>
            <div className="mt-4"><CalcResultView result={current ?? calc.result} /></div>
            {priceChanged && <p className="notice notice-info text-sm mt-4">Od uložení se změnily ceny: původně {fmtCzk(before)}, nyní {fmtCzk(now ?? 0)}{calc.result.shipping ? "" : " (bez dopravy)"}. Do košíku vkládáme aktuální ceny.</p>}
            {!current && <p className="notice notice-warn text-sm mt-4">Tato podlaha je momentálně pozastavena nebo nedostupná. Otevřete kalkulaci a vyberte jiný dekor — rozměry zůstanou.</p>}
            <div className="mt-6"><SavedCalcActions calcId={calc.id} result={current ?? calc.result} disabled={!current} /></div>
          </div>
        </div>
      </div>
    </Site>
  );
}
