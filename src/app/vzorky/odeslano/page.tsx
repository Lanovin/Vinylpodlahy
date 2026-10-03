import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { Check, Cube, Ruler } from "@/components/ui/icons";

// Patička (Site) se čte z administrace — nerenderovat staticky při buildu.
export const dynamic = "force-dynamic";
export const metadata = { title: "Vzorky odeslány", robots: { index: false } };

export default function Page() {
  return (
    <Site>
      <div className="container py-12 md:py-24 max-w-2xl text-center">
        <span className="mx-auto h-14 w-14 rounded-full bg-sage-soft text-sage grid place-items-center"><Check className="h-7 w-7" /></span>
        <h1 className="h2 mt-6">Vzorky jsou na cestě.</h1>
        <p className="lead mt-4">Dorazí poštou do 3–5 pracovních dnů. Mezitím si podlahu vyzkoušejte ve 3D.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/vizualizace" className="btn btn-accent"><Cube className="h-4 w-4" /> Byt ve 3D</Link><Link href="/kalkulacka" className="btn btn-outline"><Ruler className="h-4 w-4" /> Spočítat cenu</Link></div>
      </div>
    </Site>
  );
}
