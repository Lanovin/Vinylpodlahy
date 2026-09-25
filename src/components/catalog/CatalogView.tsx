import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { ProductCard } from "@/components/product/ProductCard";
import { FilterPanel, type Facets } from "./FilterPanel";
import { SortSelect } from "./SortSelect";
import { applyFilters, parseFilters, type LandingDef, type SearchParams, LANDINGS } from "@/lib/catalog";
import { content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";

function facetsOf(list: ReturnType<typeof toPublicProduct>[]): Facets {
  const f: Facets = { type: {}, lock: {}, thickness: {}, wear: {}, usage: {}, tone: {} };
  for (const p of list) {
    f.type[p.type] = (f.type[p.type] ?? 0) + 1; f.lock[p.lock] = (f.lock[p.lock] ?? 0) + 1;
    f.thickness[p.thicknessMm] = (f.thickness[p.thicknessMm] ?? 0) + 1; f.wear[p.wearLayerMm] = (f.wear[p.wearLayerMm] ?? 0) + 1;
    f.usage[p.usageClass] = (f.usage[p.usageClass] ?? 0) + 1; f.tone[p.decorTone] = (f.tone[p.decorTone] ?? 0) + 1;
  }
  return f;
}

export function CatalogView({ sp, landing }: { sp: SearchParams; landing?: LandingDef }) {
  const cfg = settingsRepo.get();
  const c = contentRepo.get();
  const all = products.visible().map(toPublicProduct);
  const filters = parseFilters(sp, landing?.preset ?? {});
  // Facety počítáme nad množinou omezenou jen „zamčenou“ částí landing page.
  const base = landing ? applyFilters(all, parseFilters({}, landing.preset)) : all;
  const list = applyFilters(all, filters);
  const text = landing ? c.landings[landing.slug] : null;
  const title = text?.h1 ?? (filters.q ? `Hledání: „${filters.q}“` : "Vinylové a SPC podlahy");

  return (
    <Site>
      <div className="container pt-8 md:pt-12">
        <nav className="text-xs text-muted mb-4" aria-label="Drobečková navigace"><Link href="/" className="hover:text-ink">Domů</Link> / <Link href="/podlahy" className="hover:text-ink">Podlahy</Link>{landing && <> / <span className="text-ink">{text?.h1}</span></>}</nav>
        <div className="grid md:grid-cols-12 gap-6 items-end">
          <div className="md:col-span-8"><h1 className="h2">{title}</h1>{text?.intro && <p className="lead mt-3">{text.intro}</p>}{!landing && !filters.q && <p className="lead mt-3">Filtrujte podle typu, tloušťky, nášlapné vrstvy nebo třídy zátěže. Každou cenu uvádíme za m² i za balení.</p>}</div>
          <div className="md:col-span-4 md:text-right text-sm text-muted">{list.length} {list.length === 1 ? "podlaha" : list.length < 5 ? "podlahy" : "podlah"}</div>
        </div>
        <div className="mt-6 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <Link href="/podlahy" className={`tag !py-1.5 !px-3 !text-[0.8rem] normal-case tracking-normal whitespace-nowrap ${!landing ? "!bg-ink !text-white !border-ink" : "hover:border-ink"}`}>Vše</Link>
          {LANDINGS.map((l) => (<Link key={l.slug} href={`/${l.slug}`} className={`tag !py-1.5 !px-3 !text-[0.8rem] normal-case tracking-normal whitespace-nowrap ${landing?.slug === l.slug ? "!bg-ink !text-white !border-ink" : "hover:border-ink"}`}>{l.navLabel}</Link>))}
        </div>
      </div>
      <div className="container py-8 grid lg:grid-cols-[260px_1fr] gap-8 lg:gap-12">
        <FilterPanel filters={filters} facets={facetsOf(base)} locked={landing?.locked ?? []} total={list.length} />
        <div>
          <div className="flex items-center justify-between mb-6"><span className="text-sm text-muted hidden lg:inline">{list.length} výsledků</span><SortSelect value={filters.sort} /></div>
          {list.length === 0 ? (
            <div className="panel text-center py-16">
              <p className="h3">Této kombinaci nic neodpovídá.</p>
              <p className="text-muted mt-2">Zkuste uvolnit některý filtr, nebo nechte průvodce vybrat za vás.</p>
              <div className="mt-6 flex justify-center gap-3"><Link href={landing ? `/${landing.slug}` : "/podlahy"} className="btn btn-outline">Zrušit filtry</Link><Link href="/kalkulacka" className="btn btn-primary">Nechat si poradit v kalkulačce</Link></div>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-10">{list.map((p) => <ProductCard key={p.id} p={p} sampleMax={cfg.samples.max} />)}</div>
          )}
        </div>
      </div>
      {text?.seoText && (
        <section className="bg-surface border-t border-line"><div className="container py-14 grid md:grid-cols-12 gap-8">
          <h2 className="h3 md:col-span-4">{text.h1} — co byste měli vědět</h2>
          <p className="md:col-span-8 lead">{text.seoText}</p>
        </div></section>
      )}
    </Site>
  );
}
