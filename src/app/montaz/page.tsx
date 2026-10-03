import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { InstallForm } from "@/components/InstallForm";
import { calculations, content, products } from "@/lib/db/repos";
import { Check, Cube, Ruler } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Pokládka podlahy — poptávka podlaháře", description: "Pokládka vinylové a SPC podlahy orientačně 220–260 Kč/m². Zadejte PSČ a plochu, ověřený podlahář z okolí se ozve s cenou do 2 pracovních dnů." };

export default async function Page({ searchParams }: { searchParams: Promise<{ product?: string; calc?: string; area?: string; ok?: string }> }) {
  const sp = await searchParams;
  const calc = sp.calc ? calculations.byId(sp.calc) : null;
  const p = sp.product ? products.bySlug(sp.product) : calc ? products.byId(calc.productId) : null;
  const area = sp.area ? parseFloat(sp.area) : calc?.result.totalAreaM2 ?? null;
  // Orientační cena pokládky z „Orientačních cen na trhu“ (admin → Texty webu).
  const laying = content.get().priceGuide.rows.find((r) => /pokládk/i.test(r.label));
  // Po odeslání jen potvrzení nahoře — úvodní sloupec by na telefonu odsunul výsledek pod ohyb.
  if (sp.ok) {
    return (
      <Site>
        <div className="container py-8 md:py-14 max-w-2xl">
          <div className="panel text-center py-10 md:py-14">
            <span className="mx-auto h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
            <h1 className="h2 mt-5">Poptávku máme.</h1>
            <p className="text-muted mt-2">Podlahář se vám ozve do 2 pracovních dnů.</p>
            <div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat cenu</Link><Link href="/vizualizace" className="btn btn-outline"><Cube className="h-4 w-4" /> Byt ve 3D</Link></div>
          </div>
        </div>
      </Site>
    );
  }
  return (
    <Site>
      <div className="container py-8 md:py-14 grid lg:grid-cols-12 gap-6 lg:gap-10">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-3">Pokládka</p>
          <h1 className="h2">Pokládka podlahy</h1>
          <p className="lead mt-4">Zadejte PSČ a plochu, ověřený podlahář se ozve s cenou do 2 pracovních dnů.</p>
          {laying && (
            <p className="mt-4 inline-flex flex-wrap items-baseline gap-x-2 rounded-md bg-surface border border-line px-4 py-3">
              <span className="text-muted text-sm">Orientačně</span><strong className="text-xl tabular-nums">{laying.range}</strong>
              {laying.note && <span className="basis-full text-xs text-muted mt-1">{laying.note} Přesnou cenu pošle podlahář.</span>}
            </p>
          )}
          <ul className="hidden lg:block mt-6 space-y-2 text-ink-soft">
            <li>· Click i lepený vinyl, včetně přípravy podkladu</li>
            <li>· Demontáž staré podlahy a odvoz na přání</li>
            <li>· Termín sladíme s dodáním zboží</li>
          </ul>
        </div>
        <div className="lg:col-span-7">
          <InstallForm productId={p?.id ?? null} calculationId={calc?.id ?? null} area={Number.isFinite(area) ? area : null} productName={p ? `${p.brand} ${p.name}` : null} source={p ? "product" : "page"} />
        </div>
      </div>
    </Site>
  );
}
