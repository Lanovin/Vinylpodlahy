import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { ProductGallery } from "@/components/product/ProductGallery";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductCard } from "@/components/product/ProductCard";
import { TryInRoom } from "@/components/visualizer/TryInRoom";
import { products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct, toPublicSettings } from "@/lib/public";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";
import { fmtCzk, fmtKg, fmtMm, fmtNum2 } from "@/lib/format";
import { Droplet, Flame, Layers, Package } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const p = products.bySlug(slug);
  if (!p) return {};
  return { title: `${p.brand} ${p.name} — ${fmtCzk(p.pricePerM2)}/m²`, description: `${FLOOR_TYPE_LABEL[p.type]} ${fmtMm(p.thicknessMm)}, nášlap ${fmtMm(p.wearLayerMm)}, třída ${p.usageClass}. ${fmtCzk(p.pricePerM2)}/m², ${fmtCzk(p.pricePerPack)}/balení. Dostupnost ${fmtNum2(p.stockM2)} m².` };
}

export default async function ProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const raw = products.bySlug(slug);
  if (!raw || raw.status === "hidden") notFound();
  const cfg = settingsRepo.get();
  const p = toPublicProduct(raw);
  const related = products.visible().filter((x) => x.id !== p.id && (x.collection === p.collection || x.decorTone === p.decorTone)).slice(0, 4).map(toPublicProduct);
  const paused = raw.status === "paused";
  // Do vizualizace: tento dekor, jeho kolekce a stejný odstín — ať jde porovnat „vedle sebe“.
  const tryList = [p, ...products.visible().filter((x) => x.id !== p.id && x.stockM2 > 0)
    .sort((a, b) => Number(b.collection === p.collection) - Number(a.collection === p.collection) || Number(b.decorTone === p.decorTone) - Number(a.decorTone === p.decorTone) || a.pricePerM2 - b.pricePerM2)
    .slice(0, 11).map(toPublicProduct)];

  const specs: [string, React.ReactNode][] = [
    ["Typ podlahy", FLOOR_TYPE_LABEL[p.type]],
    ["Značka / kolekce", `${p.brand} · ${p.collection}`],
    ["Dekor", `${p.decor} (${DECOR_TONE_LABEL[p.decorTone]})`],
    ["Celková tloušťka", fmtMm(p.thicknessMm)],
    ["Nášlapná vrstva", fmtMm(p.wearLayerMm)],
    ["Třída zátěže", `${p.usageClass} — ${p.usageClass >= 42 ? "komerční, vysoká" : p.usageClass >= 33 ? "komerční, běžná / bytová intenzivní" : p.usageClass >= 32 ? "bytová, intenzivní" : p.usageClass >= 31 ? "bytová, běžná" : "bytová, nízká"}`],
    ["Způsob pokládky", LOCK_LABEL[p.lock]],
    ["Rozměr lamely", `${p.plankLengthMm} × ${p.plankWidthMm} mm`],
    ["Fáza (V-drážka)", p.bevel ? "ano" : "ne"],
    ["m² v balení", `${fmtNum2(p.m2PerPack)} m²`],
    ["Hmotnost balení", <>{fmtKg(p.packWeightKg)}{p.weightEstimated && <span className="text-warn"> (odhad — dodavatel neuvedl)</span>}</>],
    ["Podlahové topení", p.floorHeating ? "vhodná" : "nevhodná"],
    ["Integrovaná podložka", p.integratedUnderlay ? "ano — podložku nekupujete" : "ne — doporučujeme podložku"],
    ["Voděodolnost", p.waterproof ? "100 % voděodolné jádro (koupelna, kuchyň)" : "ne — jen suché místnosti"],
    ["Dostupnost", `${fmtNum2(p.stockM2)} m²`],
    ["Termín dodání", `do ${p.deliveryDays} pracovních dní`],
  ];

  return (
    <Site>
      <div className="container pt-6 md:pt-10">
        <nav className="text-xs text-muted mb-4"><Link href="/" className="hover:text-ink">Domů</Link> / <Link href="/podlahy" className="hover:text-ink">Podlahy</Link> / <Link href={`/podlahy?q=${encodeURIComponent(p.collection)}`} className="hover:text-ink">{p.collection}</Link> / <span className="text-ink">{p.decor}</span></nav>
        {paused && <div className="notice notice-warn mb-6">Tento produkt je dočasně pozastaven — dodavatel změnil cenu a čekáme na její potvrzení. Nechte si poslat vzorek, nebo se podívejte na podobné dekory níže.</div>}
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12">
          <div className="lg:col-span-7 relative">
            <ProductGallery images={[p.images.hero ?? "", p.images.card ?? "", ...(p.images.gallery.filter((g) => g !== p.images.hero && g !== p.images.card))]} alt={`${p.brand} ${p.name}`} />
            {!paused && <TryInRoom product={p} products={tryList} sampleMax={cfg.samples.max} className="absolute left-3 top-3" />}
          </div>
          <div className="lg:col-span-5">
            <p className="eyebrow">{p.brand} · {p.collection}</p>
            <h1 className="h2 mt-2">{p.decor}</h1>
            <p className="text-muted mt-2">{FLOOR_TYPE_LABEL[p.type]} · {fmtMm(p.thicknessMm)} · nášlap {fmtMm(p.wearLayerMm)} · třída {p.usageClass} · {LOCK_LABEL[p.lock]}</p>
            <div className="flex flex-wrap gap-2 mt-4">
              {p.waterproof && <span className="tag tag-sage"><Droplet className="h-3.5 w-3.5" /> voděodolné</span>}
              {p.floorHeating && <span className="tag tag-sage"><Flame className="h-3.5 w-3.5" /> podlahové topení</span>}
              {p.integratedUnderlay && <span className="tag tag-sage"><Layers className="h-3.5 w-3.5" /> integrovaná podložka</span>}
              <span className="tag"><Package className="h-3.5 w-3.5" /> {fmtNum2(p.m2PerPack)} m² / bal</span>
            </div>
            <div className="mt-6">{paused ? <div className="panel text-muted">Prodej je pozastaven do potvrzení nové ceny.</div> : <BuyBox p={p} settings={toPublicSettings(cfg)} />}</div>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 mt-16">
          <div className="lg:col-span-7">
            <h2 className="h3 mb-4">Parametry</h2>
            <table className="spec"><tbody>{specs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
          </div>
          <div className="lg:col-span-5">
            <h2 className="h3 mb-4">O podlaze</h2>
            <p className="leading-relaxed text-ink-soft">{p.description}</p>
            <h3 className="h3 mt-8 mb-3">Co k tomu budete potřebovat</h3>
            <ul className="text-ink-soft space-y-1.5 text-[0.95rem]">
              {!p.integratedUnderlay && p.lock === "click" && <li>· Podložku (1 role = 15 m²){p.floorHeating && ", pod topení variantu s nízkým tepelným odporem"}</li>}
              {p.lock === "glue" && <li>· Disperzní lepidlo na vinyl (6 kg ≈ 20 m²)</li>}
              <li>· Soklové lišty — 1 ks (2,4 m) na každých 2,4 m obvodu</li>
              <li>· Přechodovou lištu na každé dveře</li>
              <li>· Montážní lepidlo (1 ks / 20 m lišt) a tmel (1 ks / 15 m lišt)</li>
            </ul>
            <Link href={`/kalkulacka?product=${p.slug}`} className="btn btn-primary mt-5">Spočítat vše najednou</Link>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="container py-16">
          <h2 className="h3 mb-8">Podobné dekory</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10">{related.map((r) => <ProductCard key={r.id} p={r} sampleMax={cfg.samples.max} />)}</div>
        </section>
      )}
    </Site>
  );
}
