import Image from "next/image";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { Section, SectionHead } from "@/components/ui/Section";
import { ProductCard } from "@/components/product/ProductCard";
import { HeroStart } from "@/components/calculator/HeroStart";
import { ArrowRight, Ruler, Truck, Swatch, Hammer } from "@/components/ui/icons";
import { content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { toPublicProduct } from "@/lib/public";
import { LANDINGS } from "@/lib/catalog";

export const dynamic = "force-dynamic";

const LANDING_IMG: Record<string, string> = {
  "spc-vinylove-podlahy": "/media/inspiration/minimal-oak.webp",
  "vinylove-podlahy-click": "/media/inspiration/living-oak.webp",
  "vinyl-do-koupelny": "/media/inspiration/marble-hall.webp",
  "vinyl-na-podlahove-topeni": "/media/inspiration/light-hall.webp",
  "vinylove-podlahy-dub": "/media/inspiration/herringbone.webp",
};
const USP_ICONS = [Ruler, Truck, Swatch, Hammer];

export default function HomePage() {
  const c = contentRepo.get();
  const cfg = settingsRepo.get();
  const visible = products.visible().filter((p) => p.stockM2 > 0);
  const featured = visible.sort((a, b) => b.stockM2 - a.stockM2).slice(0, 8).map(toPublicProduct);
  const prices = visible.map((p) => p.pricePerM2);
  const minPrice = prices.length ? Math.min(...prices) : 0;
  const maxPrice = prices.length ? Math.max(...prices) : 0;

  return (
    <Site overlay>
      {/* HERO — celoplošná fotka, lehký nadpis, obrysová tlačítka; kalkulačka je hned pod ní */}
      <section className="relative min-h-[78svh] md:min-h-[86svh] flex items-center justify-center text-white">
        <Image src={c.hero.image} alt="" fill priority sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-ink/60 via-ink/45 to-ink/70" />
        <div className="relative container text-center py-28">
          <h1 className="display fade-up">{c.hero.title}</h1>
          <p className="lead lead-light max-w-2xl mx-auto mt-6 fade-up fade-up-2">{c.hero.subtitle}</p>
          <div className="mt-10 flex flex-col sm:flex-row gap-3 justify-center fade-up fade-up-3">
            <a href="#kalkulacka" className="btn btn-accent btn-lg">{c.hero.ctaPrimary}</a>
            <Link href="/vzorky" className="btn btn-outline-light btn-lg">{c.hero.ctaSecondary}</Link>
            <Link href="/podlahy" className="btn btn-outline-light btn-lg">{c.hero.ctaTertiary}</Link>
          </div>
        </div>
        <a href="#kalkulacka" className="absolute bottom-6 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-xs text-white/80">
          <span className="h-9 w-5 rounded-full border border-white/70 flex justify-center pt-1.5"><span className="scroll-dot h-1.5 w-1.5 rounded-full bg-white" /></span>
          spočítat projekt
        </a>
      </section>

      {/* KALKULAČKA — první krok přímo na úvodní stránce */}
      <Section id="kalkulacka" className="scroll-mt-20">
        <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-center">
          <div className="lg:col-span-5">
            <p className="eyebrow mb-3">Kalkulačka projektu</p>
            <h2 className="h2">Přijďte s místností. Odejděte s cenou celého projektu.</h2>
            <p className="lead mt-4">Zadejte metry, odpovězte na čtyři otázky a uvidíte 6–9 podlah, které dávají smysl — u každé rovnou cenu za balení s prořezem, podložku, lišty i dopravu.</p>
            <ul className="mt-6 space-y-2 text-ink-soft">
              <li className="flex gap-3"><span className="text-accent">01</span>Metry a způsob kladení</li>
              <li className="flex gap-3"><span className="text-accent">02</span>Rozpočet, místnost, požadavky, barva</li>
              <li className="flex gap-3"><span className="text-accent">03</span>Nabídka s cenou projektu → jedním tlačítkem do košíku</li>
            </ul>
          </div>
          <div className="lg:col-span-7">
            <HeroStart cta={c.hero.ctaPrimary} className="card p-5 sm:p-6" />
          </div>
        </div>
      </Section>

      {/* JAK TO FUNGUJE */}
      <Section id="jak" className="pt-0">
        <div className="grid md:grid-cols-12 gap-8 items-start">
          <div className="md:col-span-5"><p className="eyebrow mb-3">vinylpodlahy.cz</p><h2 className="h2">{c.homeIntro.title}</h2></div>
          <p className="lead md:col-span-6 md:col-start-7">{c.homeIntro.text}</p>
        </div>
        <ol className="grid md:grid-cols-3 gap-6 mt-14">
          {c.steps.map((s, i) => (
            <li key={s.title} className="panel">
              <span className="text-5xl font-light text-accent leading-none">{String(i + 1).padStart(2, "0")}</span>
              <h3 className="h3 mt-4">{s.title}</h3>
              <p className="text-ink-soft mt-2 leading-relaxed">{s.text}</p>
            </li>
          ))}
        </ol>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href="/kalkulacka" className="btn btn-accent btn-lg">Spustit kalkulačku projektu</Link>
          <p className="text-sm text-muted">Bez registrace. Kalkulaci uložíme pod odkaz, ke kterému se vrátíte.</p>
        </div>
      </Section>

      {/* ORIENTAČNÍ CENY */}
      <Section className="bg-surface border-y border-line">
        <div className="grid lg:grid-cols-12 gap-10 items-start">
          <div className="lg:col-span-5">
            <SectionHead eyebrow="Než začnete" title={c.priceGuide.title} text={c.priceGuide.text} />
            <div className="mt-6 rounded-md bg-bg p-5">
              <p className="eyebrow">Naše nabídka</p>
              <p className="text-2xl mt-1 tabular-nums">{minPrice}–{maxPrice} Kč/m²</p>
              <p className="text-sm text-muted mt-1">{visible.length} dekorů skladem u partnerů · vzorky zdarma · cena za m² i za balení vždy vedle sebe</p>
            </div>
            <Link href="/kalkulacka" className="inline-flex items-center gap-2 mt-6 hover:gap-3 transition-all">Spočítat, kolik zaplatím já <ArrowRight className="h-4 w-4" /></Link>
          </div>
          <div className="lg:col-span-7">
            <table className="spec">
              <tbody>
                {c.priceGuide.rows.map((r) => (
                  <tr key={r.label}><th>{r.label}</th><td><span className="tabular-nums text-ink">{r.range}</span><span className="block text-sm text-muted mt-0.5">{r.note}</span></td></tr>
                ))}
              </tbody>
            </table>
            <p className="text-xs text-muted mt-3">{c.priceGuide.source}</p>
          </div>
        </div>
      </Section>

      {/* VÝHODY */}
      <Section>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {c.usps.map((u, i) => { const Icon = USP_ICONS[i % USP_ICONS.length]; return (
            <div key={u.title} className="border-t border-ink pt-5">
              <Icon className="h-7 w-7 mb-4" />
              <h3 className="h3">{u.title}</h3>
              <p className="text-ink-soft mt-2 leading-relaxed">{u.text}</p>
            </div>
          ); })}
        </div>
      </Section>

      {/* KATEGORIE */}
      <Section className="pt-0">
        <SectionHead eyebrow="Raději si vybíráte sami?" title="Vyberte podle místa, ne podle katalogu." />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mt-10">
          {LANDINGS.map((l, i) => (
            <Link key={l.slug} href={`/${l.slug}`} className={`group relative overflow-hidden rounded-md aspect-[3/4] ${i === 0 ? "col-span-2 lg:col-span-1 aspect-[2/1] lg:aspect-[3/4]" : ""}`}>
              <Image src={LANDING_IMG[l.slug]} alt={c.landings[l.slug]?.h1 ?? l.navLabel} fill sizes="(max-width: 1024px) 50vw, 20vw" className="object-cover transition-transform duration-500 group-hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-ink/70 via-ink/10 to-transparent" />
              <div className="absolute bottom-0 p-4 text-white">
                <p className="text-lg leading-tight">{c.landings[l.slug]?.h1 ?? l.navLabel}</p>
                <p className="text-xs text-white/70 mt-1 inline-flex items-center gap-1">Zobrazit <ArrowRight className="h-3.5 w-3.5" /></p>
              </div>
            </Link>
          ))}
        </div>
      </Section>

      {/* DEKORY */}
      <Section className="bg-surface border-y border-line">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <SectionHead eyebrow="Nejžádanější dekory" title="Skladem u partnerů, připravené k odeslání." text="Dostupnost uvádíme v m² a termín ve dnech — přesně tak, jak nám ho hlásí dodavatel." />
          <Link href="/podlahy" className="btn btn-outline">Celý katalog</Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 mt-10">
          {featured.map((p) => <ProductCard key={p.id} p={p} sampleMax={cfg.samples.max} />)}
        </div>
      </Section>

      {/* VZORKY */}
      <section className="relative text-white">
        <Image src="/media/inspiration/dark-lounge.webp" alt="" fill sizes="100vw" className="object-cover" />
        <div className="absolute inset-0 bg-ink/70" />
        <div className="relative container py-24 md:py-32 grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="eyebrow text-white/60 mb-3">Vzorky zdarma</p>
            <h2 className="h2">Podlahu vybírejte na své podlaze, ve svém světle.</h2>
            <p className="lead lead-light mt-4">Až {cfg.samples.max} vzorků domů zdarma. Bez platby, bez závazku. Stačí e-mail a adresa.</p>
          </div>
          <div className="md:text-right"><Link href="/vzorky" className="btn btn-outline-light btn-lg">Vybrat vzorky</Link></div>
        </div>
      </section>

      {/* O NÁS */}
      <Section>
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="relative aspect-[4/3] rounded-md overflow-hidden"><Image src="/media/inspiration/office-corridor.webp" alt="" fill sizes="50vw" className="object-cover" /></div>
          <div>
            <p className="eyebrow mb-3">{c.about.title}</p>
            <h2 className="h2">Neslibujeme sklad. Slibujeme správný výběr a přesný výpočet.</h2>
            <p className="lead mt-4">{c.about.text}</p>
            <div className="mt-6 flex gap-3"><Link href="/doprava" className="btn btn-outline">Jak funguje doprava</Link><Link href="/montaz" className="btn btn-ghost">Poptat pokládku</Link></div>
          </div>
        </div>
      </Section>
    </Site>
  );
}
