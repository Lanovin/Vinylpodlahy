import Link from "next/link";
import { Site } from "@/components/layout/Site";
import type { SiteContent } from "@/lib/types";
import { LEGAL_EFFECTIVE_DATE, LEGAL_PAGES } from "./pages";

export interface LegalSection { id: string; title: string; body: React.ReactNode }

/** Typografie dlouhého textu (odstavce, seznamy, tabulky) — utility, aby nepřebíjely nic globálně. */
const PROSE = "text-ink-soft leading-relaxed [&_p]:mt-3 [&_ul]:mt-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mt-3 [&_ol]:list-decimal [&_ol]:pl-5 [&_li]:mt-1.5 [&_li]:pl-1 [&_strong]:text-ink [&_strong]:font-normal [&_a]:underline [&_a]:underline-offset-2 [&_h3]:text-ink [&_h3]:text-lg [&_h3]:mt-6";

/** Společná šablona právní stránky: nadpis, účinnost, obsah s kotvami, číslované oddíly, odkazy na ostatní dokumenty. */
export function LegalPage({ href, title, lead, sections, children }: { href: string; title: string; lead?: React.ReactNode; sections: LegalSection[]; children?: React.ReactNode }) {
  return (
    <Site>
      <article className="container py-8 md:py-14 max-w-3xl">
        <p className="eyebrow mb-3">Informace pro zákazníky</p>
        <h1 className="h2">{title}</h1>
        <p className="text-sm text-muted mt-3">Účinné od {LEGAL_EFFECTIVE_DATE}</p>
        {lead && <div className={`mt-4 ${PROSE}`}>{lead}</div>}

        <nav aria-label="Obsah" className="card mt-8 p-4 md:p-5">
          <p className="eyebrow mb-2">Obsah</p>
          <ol className="text-sm columns-1 sm:columns-2 gap-8">
            {sections.map((s, i) => (
              <li key={s.id} className="break-inside-avoid"><a href={`#${s.id}`} className="flex gap-2 min-h-10 sm:min-h-0 sm:py-1 items-center hover:underline"><span className="text-muted tabular-nums w-5 shrink-0">{i + 1}.</span>{s.title}</a></li>
            ))}
          </ol>
        </nav>

        {sections.map((s, i) => (
          <section key={s.id} id={s.id} className="scroll-mt-24 mt-10 md:mt-12">
            <h2 className="h3"><span className="text-muted tabular-nums">{i + 1}.</span> {s.title}</h2>
            <div className={PROSE}>{s.body}</div>
          </section>
        ))}

        {children}

        <nav aria-label="Další dokumenty" className="mt-14 border-t border-line pt-6">
          <p className="eyebrow mb-2">Další dokumenty</p>
          <ul className="flex flex-wrap gap-x-5 text-sm">
            {LEGAL_PAGES.filter((p) => p.href !== href).map((p) => <li key={p.href}><Link href={p.href} className="link inline-flex items-center min-h-11">{p.label}</Link></li>)}
          </ul>
        </nav>
      </article>
    </Site>
  );
}

/** Identifikace provozovatele z administrace (Texty webu → Kontakt, provozovatel a patička). */
export function Operator({ c, role = "Prodávající" }: { c: SiteContent["contact"]; role?: string }) {
  return (
    <div className="card p-4 mt-4 text-sm leading-relaxed">
      <p><strong>{role}:</strong> {c.company}</p>
      <p className="!mt-0">sídlo: {c.address}</p>
      <p className="!mt-0">IČO: {c.ico}{c.dic ? ` · DIČ: ${c.dic}` : ""}</p>
      <p className="!mt-0">zápis: {c.registry}</p>
      <p className="!mt-0">e-mail: <a href={`mailto:${c.email}`}>{c.email}</a> · telefon: <a href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></p>
    </div>
  );
}
