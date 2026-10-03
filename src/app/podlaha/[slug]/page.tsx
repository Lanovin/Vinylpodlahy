import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Site } from "@/components/layout/Site";
import { ProductGallery } from "@/components/product/ProductGallery";
import { BuyBox } from "@/components/product/BuyBox";
import { ProductCard } from "@/components/product/ProductCard";
import { ProductUiProvider, TryInRoom } from "@/components/visualizer/TryInRoom";
import { Term } from "@/components/ui/Term";
import { LOCK_TERM, TYPE_TERM, USAGE_SHORT, type TermId } from "@/components/ui/terms";
import { products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct, toPublicSettings } from "@/lib/public";
import { DECOR_TONE_LABEL, FLOOR_TYPE_LABEL, LOCK_LABEL } from "@/lib/types";
import { fmtCzk, fmtKg, fmtMm, fmtNum2 } from "@/lib/format";
import { ArrowRight, ChevronRight, Cube, Droplet, Flame, Layers } from "@/components/ui/icons";

/** Řádek tabulky parametrů: popisek, hodnota, volitelně vysvětlení pojmu (ⓘ). */
type Spec = [label: string, value: React.ReactNode, term?: TermId];
const SpecRows = ({ rows }: { rows: Spec[] }) => (
  <table className="spec"><tbody>{rows.map(([k, v, t]) => <tr key={k}><th>{k}{t && <> <Term id={t} /></>}</th><td>{v}</td></tr>)}</tbody></table>
);

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
  const keySpecs: Spec[] = [
    ["Typ podlahy", FLOOR_TYPE_LABEL[p.type], TYPE_TERM[p.type]],
    ["Tloušťka", fmtMm(p.thicknessMm)],
    ["Nášlapná vrstva", fmtMm(p.wearLayerMm), "wear"],
    ["Třída zátěže", `${p.usageClass} — ${USAGE_SHORT[p.usageClass]}`, "usage"],
    ["Pokládka", LOCK_LABEL[p.lock], LOCK_TERM[p.lock]],
    ["Podlahové topení", p.floorHeating ? "vhodná" : "nevhodná", "heating"],
    ["Voděodolnost", p.waterproof ? "ano — i do koupelny" : "ne — jen suché místnosti", "waterproof"],
  ];
  const moreSpecs: Spec[] = [
    [p.decorTone === "stone" ? "Rozměr dlaždice" : "Rozměr lamely", `${p.plankLengthMm} × ${p.plankWidthMm} mm`],
    ["Hrany", p.bevel ? "s fází (V-drážka)" : "bez fáze", "bevel"],
    ["Značka / kolekce", `${p.brand} · ${p.collection}`],
    ["Odstín", DECOR_TONE_LABEL[p.decorTone]],
    ["Integrovaná podložka", p.integratedUnderlay ? "ano — podložku nekupujete" : "ne (podložku přidá kalkulačka)", "ixpe"],
    ["m² v balení", `${fmtNum2(p.m2PerPack)} m²`],
    ["Hmotnost balení", <>{fmtKg(p.packWeightKg)}{p.weightEstimated && <span className="text-warn"> (odhad — dodavatel neuvedl)</span>}</>],
  ];
  // U lepeného a samolepicího vinylu typ pokládku už říká.
  const summary = [FLOOR_TYPE_LABEL[p.type], fmtMm(p.thicknessMm), `nášlap ${fmtMm(p.wearLayerMm)}`, USAGE_SHORT[p.usageClass], p.lock === "click" ? LOCK_LABEL[p.lock] : null].filter(Boolean).join(" · ");

  return (
    <Site>
      <ProductUiProvider product={p} products={tryList} sampleMax={cfg.samples.max}>
      <div className="container pt-3 md:pt-10">
        <nav className="text-xs text-muted mb-3 md:mb-4 hidden sm:block"><Link href="/" className="hover:text-ink">Domů</Link> / <Link href="/podlahy" className="hover:text-ink">Podlahy</Link> / <Link href={`/podlahy?q=${encodeURIComponent(p.collection)}`} className="hover:text-ink">{p.collection}</Link> / <span className="text-ink">{p.decor}</span></nav>
        <Link href={`/podlahy?q=${encodeURIComponent(p.collection)}`} className="sm:hidden inline-flex items-center gap-1 h-9 text-sm text-muted"><ChevronRight className="h-4 w-4 rotate-180" /> {p.brand} · {p.collection}</Link>
        {paused && <div className="notice notice-warn mb-6">Produkt je dočasně pozastaven — čekáme na potvrzení nové ceny od dodavatele. Nechte si poslat vzorek, nebo se podívejte na podobné dekory.</div>}
        <div className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-4 sm:gap-6 lg:gap-12">
          <div className="lg:col-span-7">
            <ProductGallery images={[p.images.hero ?? "", p.images.card ?? "", ...(p.images.gallery.filter((g) => g !== p.images.hero && g !== p.images.card))]} alt={`${p.brand} ${p.name}`}>
              {/* Nahoře (zeď), ať tlačítko nezakrývá podlahu */}
              {!paused && <TryInRoom className="btn-sm sm:h-11 absolute left-3 top-3 bg-white/95 text-ink shadow-card hover:bg-white"><Cube className="h-5 w-5" /> Byt ve 3D</TryInRoom>}
            </ProductGallery>
          </div>
          {/* Na telefonu: název, cena a hlavní tlačítko hned pod fotkou; štítky až pod nákupním boxem */}
          <div className="lg:col-span-5 flex flex-col">
            <p className="eyebrow hidden sm:block">{p.brand} · {p.collection}</p>
            <h1 className="h2 sm:mt-1.5">{p.decor}</h1>
            <p className="text-sm text-muted mt-1">{summary}</p>
            {(p.waterproof || p.floorHeating || p.integratedUnderlay) && (
              <div className="flex flex-wrap gap-2 mt-4 sm:mt-3 order-last sm:order-none">
                {p.waterproof && <span className="tag tag-sage text-xs"><Droplet className="h-3.5 w-3.5" /> voděodolné</span>}
                {p.floorHeating && <span className="tag tag-sage text-xs"><Flame className="h-3.5 w-3.5" /> podlahové topení</span>}
                {p.integratedUnderlay && <span className="tag tag-sage text-xs"><Layers className="h-3.5 w-3.5" /> podložka v ceně</span>}
              </div>
            )}
            <div className="mt-4 sm:mt-5">{paused ? <div className="panel text-muted">Prodej je pozastaven do potvrzení nové ceny.</div> : <BuyBox p={p} settings={toPublicSettings(cfg)} />}</div>
          </div>
        </div>

        <div className="mt-10 md:mt-16 lg:w-7/12">
          <p className="leading-relaxed text-ink-soft mb-6">{p.description}</p>
          <h2 className="h3 mb-3">Parametry</h2>
          <SpecRows rows={keySpecs} />
          <details className="group">
            <summary className="cursor-pointer list-none h-11 flex items-center gap-2 text-sm text-ink-soft [&::-webkit-details-marker]:hidden">Všechny parametry <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
            <SpecRows rows={moreSpecs} />
          </details>
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
