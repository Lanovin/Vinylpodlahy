import { content } from "@/lib/db/repos";
import { Card, PageHead, Saved } from "@/components/admin/ui";
import { saveContentAction } from "../../actions";
import { LANDINGS } from "@/lib/catalog";

function F({ name, label, value, rows }: { name: string; label: string; value: string; rows?: number }) {
  return <div><label className="label" htmlFor={name}>{label}</label>{rows ? <textarea id={name} name={name} className="textarea" rows={rows} defaultValue={value} /> : <input id={name} name={name} className="input" defaultValue={value} />}</div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const c = content.get();
  const { saved } = await searchParams;
  return (
    <>
      <PageHead title="Texty webu" text="Vše, co je na webu vidět jako text, se upravuje tady. Uloží se do data/content.json." />
      <Saved show={!!saved} />
      <form action={saveContentAction} className="space-y-4">
        <Card><h2 className="text-lg mb-4">Úvodní stránka — hero</h2><div className="grid md:grid-cols-2 gap-4">
          <F name="hero.title" label="Hlavní nadpis" value={c.hero.title} /><F name="hero.image" label="Obrázek (cesta v /public)" value={c.hero.image} />
          <div className="md:col-span-2"><F name="hero.subtitle" label="Podtitulek" value={c.hero.subtitle} rows={2} /></div>
          <F name="hero.ctaPrimary" label="Text odkazu (šipka)" value={c.hero.ctaPrimary} /><F name="hero.ctaSecondary" label="Tlačítko 2" value={c.hero.ctaSecondary} /><F name="hero.ctaTertiary" label="Tlačítko 3" value={c.hero.ctaTertiary} />
        </div></Card>
        <Card><h2 className="text-lg mb-4">Úvod a výhody</h2><div className="grid gap-4">
          <F name="homeIntro.title" label="Nadpis úvodu" value={c.homeIntro.title} /><F name="homeIntro.text" label="Text úvodu" value={c.homeIntro.text} rows={3} />
          <div className="grid md:grid-cols-2 gap-4">{c.usps.map((u, i) => <div key={i} className="space-y-2 p-3 rounded bg-bg"><F name={`usp.${i}.title`} label={`Výhoda ${i + 1} — nadpis`} value={u.title} /><F name={`usp.${i}.text`} label="Text" value={u.text} rows={2} /></div>)}</div>
        </div></Card>
        <Card><h2 className="text-lg mb-4">Jak to funguje (3 kroky)</h2><div className="grid md:grid-cols-3 gap-4">{c.steps.map((s, i) => <div key={i} className="space-y-2"><F name={`step.${i}.title`} label={`Krok ${i + 1}`} value={s.title} /><F name={`step.${i}.text`} label="Text" value={s.text} rows={3} /></div>)}</div></Card>
        <Card><h2 className="text-lg mb-1">Orientační ceny na trhu</h2><p className="text-sm text-muted mb-4">Sekce na úvodní stránce a v kroku „Rozpočet“ kalkulačky. Rozpětí aktualizujte podle trhu.</p><div className="grid gap-4">
          <F name="priceGuide.title" label="Nadpis" value={c.priceGuide.title} /><F name="priceGuide.text" label="Text" value={c.priceGuide.text} rows={2} />
          <div className="grid md:grid-cols-2 gap-4">{c.priceGuide.rows.map((r, i) => <div key={i} className="space-y-2 p-3 rounded bg-bg"><F name={`priceGuide.${i}.label`} label={`Řádek ${i + 1} — položka`} value={r.label} /><F name={`priceGuide.${i}.range`} label="Cenové rozpětí" value={r.range} /><F name={`priceGuide.${i}.note`} label="Poznámka" value={r.note} /></div>)}</div>
          <F name="priceGuide.source" label="Zdroj / poznámka pod tabulkou" value={c.priceGuide.source} />
        </div></Card>
        <Card><h2 className="text-lg mb-4">O nás</h2><div className="grid gap-4"><F name="about.title" label="Nadpis (eyebrow)" value={c.about.title} /><F name="about.text" label="Text" value={c.about.text} rows={3} /></div></Card>
        <Card><h2 className="text-lg mb-4">Kontakt a patička</h2><div className="grid md:grid-cols-2 gap-4">
          <F name="contact.email" label="E-mail" value={c.contact.email} /><F name="contact.phone" label="Telefon" value={c.contact.phone} /><F name="contact.hours" label="Provozní doba" value={c.contact.hours} /><F name="contact.company" label="Firma" value={c.contact.company} />
          <div className="md:col-span-2"><F name="contact.address" label="Adresa" value={c.contact.address} /></div><div className="md:col-span-2"><F name="footerNote" label="Poznámka v patičce" value={c.footerNote} rows={2} /></div>
        </div></Card>
        <Card><h2 className="text-lg mb-1">SEO landing pages</h2><p className="text-sm text-muted mb-4">Každá kombinace hlavních filtrů má vlastní URL, H1 a text.</p>
          <div className="space-y-6">{LANDINGS.map((l) => { const t = c.landings[l.slug]; return (
            <div key={l.slug} className="p-4 rounded bg-bg space-y-3"><p className="text-sm">/{l.slug}</p>
              <div className="grid md:grid-cols-2 gap-3"><F name={`landing.${l.slug}.h1`} label="H1" value={t.h1} /><F name={`landing.${l.slug}.metaTitle`} label="Meta title" value={t.metaTitle} /></div>
              <F name={`landing.${l.slug}.intro`} label="Úvodní věta" value={t.intro} rows={2} /><F name={`landing.${l.slug}.seoText`} label="SEO text pod výpisem" value={t.seoText} rows={3} /><F name={`landing.${l.slug}.metaDescription`} label="Meta description" value={t.metaDescription} rows={2} />
            </div>); })}</div>
        </Card>
        <div className="sticky bottom-4"><button className="btn btn-primary btn-lg shadow-card">Uložit texty</button></div>
      </form>
    </>
  );
}
