import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { ProductGallery } from "@/components/product/ProductGallery";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductCalcLink, ProductUiProvider, TryInRoom } from "@/components/visualizer/TryInRoom";
import { products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct, toPublicSettings } from "@/lib/public";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";
import { fmtCzk, fmtKg, fmtMm, fmtNum2 } from "@/lib/format";
import { ArrowRight, ChevronRight, Cube, Droplet, Flame, Layers } from "@/components/ui/icons";

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

  // Klíčové parametry na očích, zbytek sbalený; dostupnost a termín jsou v BuyBoxu.
  const keySpecs: [string, React.ReactNode][] = [
    ["Tloušťka / nášlap", `${fmtMm(p.thicknessMm)} / ${fmtMm(p.wearLayerMm)}`],
    ["Třída zátěže", `${p.usageClass} — ${p.usageClass >= 42 ? "komerční, vysoká" : p.usageClass >= 33 ? "komerční, běžná / bytová intenzivní" : p.usageClass >= 32 ? "bytová, intenzivní" : p.usageClass >= 31 ? "bytová, běžná" : "bytová, nízká"}`],
    ["Pokládka", LOCK_LABEL[p.lock]],
    ["Rozměr lamely", `${p.plankLengthMm} × ${p.plankWidthMm} mm, ${p.bevel ? "s fází" : "bez fáze"}`],
    ["Podlahové topení", p.floorHeating ? "vhodná" : "nevhodná"],
    ["Voděodolnost", p.waterproof ? "ano — i do koupelny" : "ne — jen suché místnosti"],
  ];
  const moreSpecs: [string, React.ReactNode][] = [
    ["Typ podlahy", FLOOR_TYPE_LABEL[p.type]],
    ["Značka / kolekce", `${p.brand} · ${p.collection}`],
    ["Odstín", DECOR_TONE_LABEL[p.decorTone]],
    ["Integrovaná podložka", p.integratedUnderlay ? "ano — podložku nekupujete" : "ne (podložku přidá kalkulačka)"],
    ["m² v balení", `${fmtNum2(p.m2PerPack)} m²`],
    ["Hmotnost balení", <>{fmtKg(p.packWeightKg)}{p.weightEstimated && <span className="text-warn"> (odhad — dodavatel neuvedl)</span>}</>],
  ];
  // U lepeného a samolepicího vinylu typ pokládku už říká.
  const summary = [FLOOR_TYPE_LABEL[p.type], fmtMm(p.thicknessMm), `nášlap ${fmtMm(p.wearLayerMm)}`, `tř. ${p.usageClass}`, p.lock === "click" ? LOCK_LABEL[p.lock] : null].filter(Boolean).join(" · ");
  const needs = [!p.integratedUnderlay && p.lock === "click" ? "podložku" : null, "soklové a přechodové lišty", p.lock === "glue" ? "lepidlo na vinyl" : null, "montážní lepidlo a tmel"].filter(Boolean).join(", ");

  return (
    <Site>
      <ProductUiProvider product={p} products={tryList} sampleMax={cfg.samples.max}>
      <div className="container pt-3 md:pt-10">
        <nav className="text-xs text-muted mb-3 md:mb-4 hidden sm:block"><Link href="/" className="hover:text-ink">Domů</Link> / <Link href="/podlahy" className="hover:text-ink">Podlahy</Link> / <Link href={`/podlahy?q=${encodeURIComponent(p.collection)}`} className="hover:text-ink">{p.collection}</Link> / <span className="text-ink">{p.decor}</span></nav>
        <Link href={`/podlahy?q=${encodeURIComponent(p.collection)}`} className="sm:hidden inline-flex items-center gap-1 h-9 mb-1 text-sm text-muted"><ChevronRight className="h-4 w-4 rotate-180" /> {p.collection}</Link>
        {paused && <div className="notice notice-warn mb-6">Produkt je dočasně pozastaven — čekáme na potvrzení nové ceny od dodavatele. Nechte si poslat vzorek, nebo se podívejte na podobné dekory.</div>}
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-6 lg:gap-12">
          <div className="lg:col-span-7">
            <ProductGallery images={[p.images.hero ?? "", p.images.card ?? "", ...(p.images.gallery.filter((g) => g !== p.images.hero && g !== p.images.card))]} alt={`${p.brand} ${p.name}`}>
              {!paused && <TryInRoom className="absolute left-3 bottom-3 sm:bottom-auto sm:top-3 bg-white/95 text-ink shadow-card hover:bg-white"><Cube className="h-5 w-5" /> Vyzkoušet v interiéru</TryInRoom>}
            </ProductGallery>
          </div>
          <div className="lg:col-span-5">
            <p className="eyebrow">{p.brand} · {p.collection}</p>
            <h1 className="h2 mt-1.5">{p.decor}</h1>
            <p className="text-sm text-muted mt-1.5">{summary}</p>
            {(p.waterproof || p.floorHeating || p.integratedUnderlay) && (
              <div className="flex flex-wrap gap-2 mt-3">
                {p.waterproof && <span className="tag tag-sage"><Droplet className="h-3.5 w-3.5" /> voděodolné</span>}
                {p.floorHeating && <span className="tag tag-sage"><Flame className="h-3.5 w-3.5" /> podlahové topení</span>}
                {p.integratedUnderlay && <span className="tag tag-sage"><Layers className="h-3.5 w-3.5" /> integrovaná podložka</span>}
              </div>
            )}
            <div className="mt-5">{paused ? <div className="panel text-muted">Prodej je pozastaven do potvrzení nové ceny.</div> : <BuyBox p={p} settings={toPublicSettings(cfg)} />}</div>
          </div>
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-12 mt-10 md:mt-16">
          <div className="lg:col-span-7">
            <p className="leading-relaxed text-ink-soft mb-6">{p.description}</p>
            <h2 className="h3 mb-3">Parametry</h2>
            <table className="spec"><tbody>{keySpecs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
            <details className="group">
              <summary className="cursor-pointer list-none h-11 flex items-center gap-2 text-sm text-ink-soft [&::-webkit-details-marker]:hidden">Všechny parametry <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
              <table className="spec"><tbody>{moreSpecs.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
            </details>
          </div>
          <div className="lg:col-span-5">
            <div className="panel">
              <h2 className="h3">K podlaze budete potřebovat</h2>
              <p className="text-ink-soft mt-2 leading-relaxed">{needs.charAt(0).toUpperCase() + needs.slice(1)}. Kalkulačka spočítá přesné množství i dopravu.</p>
              <ProductCalcLink product={p} className="btn btn-primary mt-4 w-full sm:w-auto">Spočítat vše na můj byt <ArrowRight className="h-4 w-4" /></ProductCalcLink>
            </div>
          </div>
        </div>
      </div>
      {related.length > 0 && (
        <section className="container py-10 md:py-16">
          <h2 className="h3 mb-5 md:mb-8">Podobné dekory</h2>
          <div className="flex gap-3 overflow-x-auto snap-x scroll-px-4 no-scrollbar -mx-4 px-4 sm:mx-0 sm:px-0 sm:grid sm:grid-cols-2 lg:grid-cols-4 sm:gap-x-4 sm:gap-y-10 sm:overflow-visible">
            {related.map((r) => <div key={r.id} className="w-[46%] shrink-0 snap-start sm:w-auto grid"><ProductCard p={r} sampleMax={cfg.samples.max} /></div>)}
          </div>
        </section>
      )}
      </ProductUiProvider>
    </Site>
  );
}
