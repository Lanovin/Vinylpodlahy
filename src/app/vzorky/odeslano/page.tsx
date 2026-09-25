import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { Check } from "@/components/ui/icons";

export const metadata = { title: "Vzorky odeslány", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ id?: string }> }) {
  const { id } = await searchParams;
  return (
    <Site>
      <div className="container py-24 max-w-2xl text-center">
        <span className="mx-auto h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
        <h1 className="h2 mt-6">Vzorky jsou na cestě.</h1>
        <p className="lead mt-4">Potvrzení jsme poslali na váš e-mail. Vzorky dorazí obyčejnou poštou do 3–5 pracovních dní. Mezitím si můžete <Link href="/kalkulacka" className="link">spočítat projekt</Link> — až se rozhodnete, stačí vložit do košíku.</p>
        {id && <p className="text-xs text-muted mt-6">Číslo žádosti: {id}</p>}
        <div className="mt-8 flex justify-center gap-3"><Link href="/kalkulacka" className="btn btn-primary">Kalkulačka projektu</Link><Link href="/podlahy" className="btn btn-outline">Zpět do katalogu</Link></div>
      </div>
    </Site>
  );
}
