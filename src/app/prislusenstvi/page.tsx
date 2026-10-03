import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import type { ComponentType, SVGProps } from "react";
import { Site } from "@/components/layout/Site";
import { AddAccessoryButton } from "@/components/cart/AddAccessoryButton";
import { Droplet, Layers, Package, Ruler, Sparkle } from "@/components/ui/icons";
import { accessories } from "@/lib/db/repos";
import { toPublicAccessory } from "@/lib/public";
import type { AccessoryKind } from "@/lib/types";
import { days, fmtCzk, slugify } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Příslušenství k vinylovým podlahám", description: "Podložky, soklové a přechodové lišty, lepidla, tmely a čisticí sady. Kalkulačka projektu spočítá potřebné množství automaticky." };

const ORDER: AccessoryKind[] = ["underlay", "skirting", "transition", "floor-adhesive", "glue", "silicone", "cleaning"];

/** Nadpisy sekcí jen pro tuto stránku („silicone“ je ve skutečnosti akrylový tmel). */
const SECTION_LABEL: Record<AccessoryKind, string> = {
  underlay: "Podložky",
  skirting: "Soklové lišty",
  transition: "Přechodové lišty",
  "floor-adhesive": "Lepidlo na podlahu",
  glue: "Lepidlo na lišty",
  silicone: "Tmel",
  cleaning: "Čištění",
};

/** Ikona místo chybějící fotky. */
const KIND_ICON: Record<AccessoryKind, ComponentType<SVGProps<SVGSVGElement>>> = {
  underlay: Layers, skirting: Ruler, transition: Ruler, "floor-adhesive": Package, glue: Droplet, silicone: Droplet, cleaning: Sparkle,
};

export default function Page() {
  const list = accessories.visible().map(toPublicAccessory);
  const kinds = ORDER.filter((kind) => list.some((a) => a.kind === kind));
  return (
    <Site>
      <div className="container pt-6 pb-10 md:py-14">
        <h1 className="h2">Příslušenství</h1>
        <nav className="mt-4 flex gap-2 overflow-x-auto no-scrollbar -mx-4 px-4 md:mx-0 md:px-0 md:flex-wrap" aria-label="Sekce">
          {kinds.map((kind) => <a key={kind} href={`#${slugify(SECTION_LABEL[kind])}`} className="tag h-10 shrink-0 px-3.5 text-sm normal-case tracking-normal whitespace-nowrap hover:border-ink">{SECTION_LABEL[kind]}</a>)}
        </nav>
        <div className="panel mt-5 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-6 bg-accent-soft border-transparent">
          <p className="flex-1 text-ink-soft">Kalkulačka spočítá podložku, lišty i lepidlo na míru.</p>
          <Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat cenu</Link>
        </div>
        {kinds.map((kind) => {
          const items = list.filter((a) => a.kind === kind);
          const Icon = KIND_ICON[kind];
          return (
            <section key={kind} id={slugify(SECTION_LABEL[kind])} className="mt-10 md:mt-12 scroll-mt-24">
              <h2 className="h3 mb-4 pb-3 border-b border-line">{SECTION_LABEL[kind]}</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {items.map((a) => (
                  <article key={a.id} className="card p-4 flex gap-4">
                    <div className="relative h-24 w-24 shrink-0 rounded-sm overflow-hidden bg-bg">{a.image ? <Image src={a.image} alt="" fill sizes="96px" className="object-cover" /> : <div className="absolute inset-0 grid place-items-center text-muted"><Icon className="h-9 w-9" aria-hidden /></div>}</div>
                    <div className="flex-1 min-w-0">
                      <h3 className="leading-snug">{a.name}</h3>
                      <p className="text-xs text-muted mt-1">{a.coverageLabel} · dodání {days(a.deliveryDays)}</p>
                      <p className="text-sm text-ink-soft mt-1.5 line-clamp-2">{a.description}</p>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-2"><span className="text-lg">{fmtCzk(a.pricePerUnit)}<span className="text-xs text-muted"> / {a.unit}</span></span><AddAccessoryButton id={a.id} /></div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </Site>
  );
}
