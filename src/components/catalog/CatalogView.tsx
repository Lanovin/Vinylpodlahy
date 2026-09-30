import Link from "next/link";
import clsx from "clsx";
import { Site } from "@/components/layout/Site";
import { ProductCard } from "@/components/product/ProductCard";
import { Cube, Ruler, X } from "@/components/ui/icons";
import { FilterPanel, type Facets } from "./FilterPanel";
import { SortSelect } from "./SortSelect";
import { activeChips, catalogHref, clearedFilters } from "./activeFilters";
import { applyFilters, EMPTY_FILTERS, parseFilters, type LandingDef, type SearchParams, LANDINGS } from "@/lib/catalog";
import { content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";
import { plural } from "@/lib/format";

function facetsOf(list: ReturnType<typeof toPublicProduct>[]): Facets {
  const f: Facets = { type: {}, lock: {}, thickness: {}, wear: {}, usage: {}, tone: {}, waterproof: 0, floorHeating: 0 };
  for (const p of list) {
    f.type[p.type] = (f.type[p.type] ?? 0) + 1; f.lock[p.lock] = (f.lock[p.lock] ?? 0) + 1;
    f.thickness[p.thicknessMm] = (f.thickness[p.thicknessMm] ?? 0) + 1; f.wear[p.wearLayerMm] = (f.wear[p.wearLayerMm] ?? 0) + 1;
    f.usage[p.usageClass] = (f.usage[p.usageClass] ?? 0) + 1; f.tone[p.decorTone] = (f.tone[p.decorTone] ?? 0) + 1;
    if (p.waterproof) f.waterproof++;
    if (p.floorHeating) f.floorHeating++;
  }
  return f;
}

/** Slovo „kalkulačka/kalkulačce…“ v textu z administrace vykreslí jako odkaz (text samotný se nemění). */
function withCalcLink(text: string) {
  return text.split(/(kalkulač[^\s.,;:!?()„“"]*)/i).map((part, i) => (i % 2 ? <Link key={i} href="/kalkulacka" className="link">{part}</Link> : part));
}

const chipCls = "tag h-10 shrink-0 px-3.5 text-sm normal-case tracking-normal whitespace-nowrap";

export function CatalogView({ sp, landing }: { sp: SearchParams; landing?: LandingDef }) {
  const cfg = settingsRepo.get();
  const c = contentRepo.get();
  const all = products.visible().map(toPublicProduct);
  const filters = parseFilters(sp, landing?.preset ?? {});
  const locked = landing?.locked ?? [];
  // Facety počítáme nad množinou omezenou jen „zamčenou“ částí landing page.
  const base = landing ? applyFilters(all, parseFilters({}, landing.preset)) : all;
  const list = applyFilters(all, filters);
  const text = landing ? c.landings[landing.slug] : null;
  const searching = !!filters.q && !locked.includes("q");
  const title = text?.h1 ?? (searching ? `Hledání: „${filters.q}“` : "Vinylové a SPC podlahy");
  const path = landing ? `/${landing.slug}` : "/podlahy";
  const chips = activeChips(filters, locked);
  // „Zrušit vše“ ve štítcích ruší filtry i hledání; na landing page vede na její čistou adresu (řazení zůstává).
  const clearAllHref = catalogHref(path, { ...EMPTY_FILTERS, sort: filters.sort }, locked);

  // Cesta do kalkulačky a 3D: dlaždice za 4. kartou (při menším počtu za poslední).
  const ctaAt = Math.min(3, list.length - 1);
  const cta = (
    <div key="cta" className="col-span-2 xl:col-span-3 rounded-lg bg-accent-soft p-5 md:p-7 flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
      <div className="flex-1">
        <h2 className="h3">Spočítejte to na svůj byt</h2>
        <p className="text-ink-soft mt-1.5">Zadejte metry — spočítáme balení, podložku, lišty i dopravu.</p>
      </div>
      <div className="flex flex-col sm:flex-row gap-2 md:shrink-0">
        <Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat na můj byt</Link>
        <Link href="/vizualizace" className="btn btn-outline"><Cube className="h-4 w-4" /> Vyzkoušet dekory ve 3D</Link>
      </div>
    </div>
  );

  return (
    <Site>
      <div className="container pt-4 md:pt-10">
        <nav className="hidden md:block text-xs text-muted mb-4" aria-label="Drobečková navigace"><Link href="/" className="hover:text-ink">Domů</Link> / <Link href="/podlahy" className="hover:text-ink">Podlahy</Link>{landing && <> / <span className="text-ink">{text?.h1}</span></>}</nav>
        <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h1 className="h2 min-w-0 break-words">{title}</h1>
          <span className="text-sm text-muted">{list.length} {plural(list.length, "podlaha", "podlahy", "podlah")}</span>
        </div>
        {text?.intro && <p className="text-base md:text-lg text-ink-soft mt-2 max-w-2xl">{text.intro}</p>}
        <div className="mt-4 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0">
          <Link href="/podlahy" className={clsx(chipCls, !landing && !chips.length ? "bg-ink text-white border-ink" : "hover:border-ink")}>Vše</Link>
          {LANDINGS.map((l) => (<Link key={l.slug} href={`/${l.slug}`} className={clsx(chipCls, landing?.slug === l.slug ? "bg-ink text-white border-ink" : "hover:border-ink")}>{l.navLabel}</Link>))}
        </div>
      </div>
      <div className="container pt-3 pb-10 lg:pt-8 lg:grid lg:grid-cols-[260px_1fr] lg:gap-12">
        <FilterPanel filters={filters} facets={facetsOf(base)} locked={locked} total={list.length} />
        <div className="min-w-0 pt-3 lg:pt-0">
          <div className={clsx("flex items-center gap-3 lg:mb-6", chips.length > 0 && "mb-5")}>
            {chips.length > 0 && (
              <div className="flex-1 min-w-0 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 lg:mx-0 lg:px-0 lg:flex-wrap" role="group" aria-label="Aktivní filtry">
                {chips.map((ch) => (
                  <Link key={ch.key} href={catalogHref(path, ch.next, locked)} scroll={false} className={clsx(chipCls, "gap-1.5 border-ink text-ink")} aria-label={`Zrušit filtr ${ch.label}`}>{ch.label} <X className="h-4 w-4" /></Link>
                ))}
                {chips.length > 1 && <Link href={clearAllHref} scroll={false} className={clsx(chipCls, "border-transparent bg-transparent underline underline-offset-4")}>Zrušit vše</Link>}
              </div>
            )}
            <SortSelect value={filters.sort} className="hidden lg:block h-10 w-auto shrink-0 ml-auto" />
          </div>
          {list.length === 0 ? (
            <div className="panel text-center py-12">
              <p className="h3">Nic jsme nenašli.</p>
              <p className="text-muted mt-2">{searching ? "Zkuste jiné slovo, třeba „dub“ nebo „beton“." : "Zkuste uvolnit některý filtr."}</p>
              <div className="mt-6 flex flex-col sm:flex-row justify-center gap-3">
                {searching
                  ? <Link href={catalogHref(path, { ...filters, q: "" }, locked)} className="btn btn-outline">Zrušit hledání</Link>
                  : <Link href={catalogHref(path, clearedFilters(filters), locked)} className="btn btn-outline">Zrušit filtry</Link>}
                <Link href="/kalkulacka" className="btn btn-primary">Poradit v kalkulačce</Link>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-4 gap-y-8 md:gap-y-10">
              {list.flatMap((p, i) => {
                const card = <ProductCard key={p.id} p={p} sampleMax={cfg.samples.max} />;
                return i === ctaAt ? [card, cta] : [card];
              })}
            </div>
          )}
        </div>
      </div>
      {text?.seoText && (
        <section className="bg-surface border-t border-line"><div className="container py-10 md:py-14 grid md:grid-cols-12 gap-3 md:gap-8">
          <h2 className="h3 md:col-span-4">{text.h1}: na co si dát pozor</h2>
          <p className="md:col-span-8 text-ink-soft leading-relaxed max-w-3xl">{withCalcLink(text.seoText)}</p>
        </div></section>
      )}
    </Site>
  );
}
