import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { InstallForm } from "@/components/InstallForm";
import { calculations, products } from "@/lib/db/repos";
import { Check } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Poptávka pokládky vinylové podlahy", description: "Chcete i pokládku? Zadejte PSČ, plochu a termín. Spojíme vás s ověřeným podlahářem z okolí." };

export default async function Page({ searchParams }: { searchParams: Promise<{ product?: string; calc?: string; area?: string; ok?: string }> }) {
  const sp = await searchParams;
  const calc = sp.calc ? calculations.byId(sp.calc) : null;
  const p = sp.product ? products.bySlug(sp.product) : calc ? products.byId(calc.productId) : null;
  const area = sp.area ? parseFloat(sp.area) : calc?.result.totalAreaM2 ?? null;
  return (
    <Site>
      <div className="container py-10 md:py-14 grid lg:grid-cols-12 gap-10">
        <div className="lg:col-span-5">
          <p className="eyebrow mb-3">Pokládka</p>
          <h1 className="h2">Chci i pokládku.</h1>
          <p className="lead mt-4">Podlahu dodáme, položit ji nechte profesionálovi. Pracujeme s ověřenými podlaháři po celé ČR — vy zadáte, kde a kolik, oni se ozvou s cenou.</p>
          <ul className="mt-6 space-y-2 text-ink-soft">
            <li>· Click i lepený vinyl, včetně přípravy podkladu</li>
            <li>· Demontáž staré podlahy a odvoz na přání</li>
            <li>· Termín sladíme s dodáním zboží</li>
          </ul>
          <p className="text-sm text-muted mt-6">Ještě nemáte spočítanou plochu? <Link href="/kalkulacka" className="link">Kalkulačka</Link> vám ji dá za minutu a poptávka se na ni naváže.</p>
        </div>
        <div className="lg:col-span-7">
          {sp.ok ? (
            <div className="panel text-center py-14">
              <span className="mx-auto h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
              <h2 className="h3 mt-5">Poptávku máme.</h2><p className="text-muted mt-2">Podlahář se vám ozve do 2 pracovních dnů.</p>
              <div className="mt-6 flex justify-center gap-3"><Link href="/podlahy" className="btn btn-primary">Zpět do katalogu</Link><Link href="/kosik" className="btn btn-outline">Košík</Link></div>
            </div>
          ) : (
            <InstallForm productId={p?.id ?? null} calculationId={calc?.id ?? null} area={Number.isFinite(area) ? area : null} productName={p ? `${p.brand} ${p.name}` : null} source={p ? "product" : "page"} />
          )}
        </div>
      </div>
    </Site>
  );
}
