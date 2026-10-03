import Image from "next/image";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { Section } from "@/components/ui/Section";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroStart } from "@/components/calculator/HeroStart";
import { ArrowRight, Cube, Ruler, Truck, Swatch, Hammer } from "@/components/ui/icons";
import { content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";
import { LANDINGS } from "@/lib/catalog";
import { fmtInt } from "@/lib/format";

export const dynamic = "force-dynamic";

const LANDING_IMG: Record<string, string> = {
  "spc-vinylove-podlahy": "/media/inspiration/minimal-oak.webp",
  "vinylove-podlahy-click": "/media/inspiration/living-oak.webp",
  "vinyl-do-koupelny": "/media/inspiration/marble-hall.webp",
  "vinyl-na-podlahove-topeni": "/media/inspiration/light-hall.webp",
  "vinylove-podlahy-dub": "/media/inspiration/herringbone.webp",
};
const USP_ICONS = [Ruler, Truck, Swatch, Hammer];
/** Orientační ceny: na očích jen typy podlah, příslušenství a pokládka se rozbalí. */
const PRICE_ROWS_VISIBLE = 3;
/** „Doprava zdarma od 25 m²“ v textech z adminu: číslo vždy podle nastavení dopravy. */
const withFreeShipping = (text: string, m2: number) => text.replace(/(zdarma od )\d+(?:[.,]\d+)?(\s*m²)/i, `$1${String(m2).replace(".", ",")}$2`);

export default function HomePage() {
  const c = contentRepo.get();
  const cfg = settingsRepo.get();
  const visible = products.visible().filter((p) => p.stockM2 > 0);
  const featured = visible.sort((a, b) => b.stockM2 - a.stockM2).slice(0, 8).map(toPublicProduct);
  const prices = visible.map((p) => p.pricePerM2);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;
  const priceRow = (r: (typeof c.priceGuide.rows)[number]) => <tr key={r.label}><th>{r.label}</th><td><span className="tabular-nums text-ink">{r.range}</span>{r.note && <span className="hidden sm:block text-sm text-muted mt-0.5">{r.note}</span>}</td></tr>;

  return (
    <Site overlay>
      {/* HERO — celoplošná fotka a rovnou první krok kalkulačky (metry); vedle cesta do 3D bytu */}
      <section className="relative flex items-center justify-center text-white md:min-h-[86svh]">
        <Image src={c.hero.image} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/45 to-ink/70" />
        <div className="relative container text-center pt-24 pb-8 md:py-28">
          <h1 className="display fade-up">{c.hero.title}</h1>
          <p className="lead lead-light max-w-xl mx-auto mt-3 md:mt-5 fade-up fade-up-2">{c.hero.subtitle}</p>
          <HeroStart cta={c.hero.ctaPrimary} className="mt-6 md:mt-10 fade-up fade-up-3" />
          <div className="mt-3 md:mt-5 grid grid-cols-2 sm:flex sm:justify-center gap-2 sm:gap-3 max-w-2xl mx-auto fade-up fade-up-3">
            <Link href="/vizualizace" className="btn btn-outline-light px-3"><Cube className="h-4 w-4 shrink-0" /> {c.hero.ctaTertiary}</Link>
            <Link href="/vzorky" className="btn btn-outline-light px-3"><Swatch className="h-4 w-4 shrink-0" /> {c.hero.ctaSecondary}</Link>
          </div>
        </div>
      </section>

      {/* JAK TO FUNGUJE — na telefonu zbytečné (formulář výš mluví sám za sebe) */}
      <section className="hidden md:block border-b border-line">
        <ol className="container grid grid-cols-3 gap-8 py-8">
          {c.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4">
              <span className="text-3xl font-light text-accent leading-none">{String(i + 1).padStart(2, "0")}</span>
              <div><p className="text-lg leading-tight">{s.title}</p><p className="text-sm text-muted mt-1 leading-snug">{s.text}</p></div>
            </li>
          ))}
        </ol>
      </section>

      {/* VIZUALIZACE — druhý hlavní vstup, celá karta je odkaz */}
      <section className="container pt-6 md:pt-14">
        <Link href="/vizualizace" className="group relative block overflow-hidden rounded-lg bg-line text-white aspect-[4/5] sm:aspect-[16/9] lg:aspect-[21/9]">
          <Image src="/media/inspiration/vizualizace.webp" alt="3D vizualizace obývacího pokoje s vinylovou podlahou v rybí kosti" fill sizes="(max-width: 1360px) 100vw, 1360px" className="object-cover transition-transform duration-500 group-hover:scale-[1.02]" />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 via-ink/15 to-transparent" />
          <div className="absolute inset-x-0 bottom-0 p-5 md:p-10">
            <p className="eyebrow !text-white/75 mb-2">Byt ve 3D</p>
            <h2 className="h2 max-w-xl">Vyzkoušejte podlahu ve 3D bytě.</h2>
            <p className="mt-2 text-white/85 max-w-md">Byt 2+kk: přepněte dekor, kladení i barvu stěn.</p>
            <span className="btn btn-accent btn-lg mt-5 w-full sm:w-auto"><Cube className="h-5 w-5" /> Byt ve 3D</span>
          </div>
        </Link>
      </section>

      {/* VÝHODY — na telefonu jen ikona a nadpis */}
      <Section>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-6 md:gap-6">
          {c.usps.map((u, i) => { const Icon = USP_ICONS[i % USP_ICONS.length]; return (
            <div key={u.title} className="border-t border-ink pt-4 md:pt-5">
              <Icon className="h-6 w-6 md:h-7 md:w-7 mb-3 md:mb-4" />
              <h3 className="text-base sm:text-lg md:text-xl leading-tight">{withFreeShipping(u.title, cfg.freeShippingFromM2)}</h3>
              <p className="hidden sm:block text-ink-soft mt-2 leading-relaxed">{u.text}</p>
            </div>
          ); })}
        </div>
      </Section>

      {/* DEKORY — na telefonu 4, na desktopu 8 */}
      <Section className="bg-surface border-y border-line">
        <div className="flex items-end justify-between gap-4">
          <h2 className="h2">Nejžádanější dekory</h2>
          <Link href="/podlahy" className="btn btn-outline hidden sm:inline-flex">Celý katalog</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-8 md:gap-y-10 mt-6 md:mt-10">
          {featured.map((p, i) => <div key={p.id} className={i >= 4 ? "hidden lg:block" : "contents"}><ProductCard p={p} sampleMax={cfg.samples.max} /></div>)}
        </div>
        <Link href="/podlahy" className="btn btn-outline w-full mt-8 sm:hidden">Celý katalog</Link>
      </Section>

      {/* KATEGORIE */}
      <Section>
        <h2 className="h2">Vyberte podle místnosti a typu</h2>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-6 md:mt-10">
          {LANDINGS.map((l, i) => (
            <Link key={l.slug} href={`/${l.slug}`} className={`group relative overflow-hidden rounded-md ${i === 0 ? "col-span-2 aspect-[2/1] lg:col-span-1 lg:aspect-[3/4]" : "aspect-[4/3] lg:aspect-[3/4]"}`}>
              <Image src={LANDING_IMG[l.slug]} alt={c.landings[l.slug]?.h1 ?? l.navLabel} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <p className="absolute bottom-0 p-3 md:p-4 text-white text-base md:text-lg leading-tight">{c.landings[l.slug]?.h1 ?? l.navLabel}</p>
            </Link>
          ))}
        </div>
      </Section>

      {/* ORIENTAČNÍ CENY */}
      <Section className="bg-surface border-y border-line">
        <div className="grid lg:grid-cols-12 gap-6 lg:gap-10 items-start">
          <div className="lg:col-span-5">
            <h2 className="h2">{c.priceGuide.title}</h2>
            <p className="lead mt-3">{c.priceGuide.text}</p>
            <p className="mt-4 text-ink-soft">U nás <strong className="font-normal text-ink tabular-nums">{fmtInt(minPrice)}–{fmtInt(maxPrice)} Kč/m²</strong> · {visible.length} dekorů</p>
            <Link href="/kalkulacka" className="btn btn-accent mt-5 w-full sm:w-auto"><Ruler className="h-4 w-4" /> Spočítat cenu</Link>
          </div>
          <div className="lg:col-span-7">
            <table className="spec"><tbody>{c.priceGuide.rows.slice(0, PRICE_ROWS_VISIBLE).map(priceRow)}</tbody></table>
            {c.priceGuide.rows.length > PRICE_ROWS_VISIBLE && (
              <details className="group mt-1">
                <summary className="cursor-pointer list-none py-3 text-sm text-ink-soft flex items-center gap-2 [&::-webkit-details-marker]:hidden">Příslušenství a pokládka <ArrowRight className="h-4 w-4 transition-transform group-open:rotate-90" /></summary>
                <table className="spec"><tbody>{c.priceGuide.rows.slice(PRICE_ROWS_VISIBLE).map(priceRow)}</tbody></table>
              </details>
            )}
            <p className="text-xs text-muted mt-3">{c.priceGuide.source}</p>
          </div>
        </div>
      </Section>

      {/* VZORKY */}
      <section className="relative text-white">
        <Image src="/media/inspiration/dark-lounge.webp" alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="relative container py-14 md:py-28 grid md:grid-cols-2 gap-6 md:gap-8 items-center">
          <div>
            <h2 className="h2">Vyzkoušejte vzorek doma.</h2>
            <p className="lead lead-light mt-3">Až {cfg.samples.max} vzorků zdarma, bez závazku.</p>
          </div>
          <div className="md:text-right"><Link href="/vzorky" className="btn btn-outline-light btn-lg w-full sm:w-auto">Vybrat vzorky</Link></div>
        </div>
      </section>

      {/* O NÁS + krátký text pro vyhledávače */}
      <Section>
        <div className="grid md:grid-cols-2 gap-8 md:gap-10 items-center">
          <div className="hidden md:block relative aspect-[4/3] rounded-md overflow-hidden"><Image src="/media/inspiration/office-corridor.webp" alt="" fill sizes="50vw" className="object-cover" /></div>
          <div>
            <h2 className="h2">{c.about.title}</h2>
            <p className="lead mt-3">{c.about.text}</p>
            <div className="mt-5 flex flex-wrap gap-2"><Link href="/doprava" className="btn btn-outline">Doprava a platba</Link><Link href="/montaz" className="btn btn-ghost">Poptat pokládku</Link></div>
          </div>
        </div>
        <div className="mt-12 md:mt-16 border-t border-line pt-6 max-w-3xl">
          <h2 className="text-lg">{c.homeIntro.title}</h2>
          <p className="text-sm text-muted mt-2 leading-relaxed">{c.homeIntro.text}</p>
        </div>
      </Section>
    </Site>
  );
}
