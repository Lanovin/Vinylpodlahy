import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { Cube, Ruler } from "@/components/ui/icons";

export default function NotFound() {
  return (
    <Site>
      <div className="container py-16 md:py-32 text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="h2">Tuhle stránku jsme nenašli.</h1>
        <p className="lead mt-4">Podlahu ale najdeme.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3"><Link href="/kalkulacka" className="btn btn-primary"><Ruler className="h-4 w-4" /> Spočítat projekt</Link><Link href="/vizualizace" className="btn btn-outline"><Cube className="h-4 w-4" /> Vyzkoušet ve 3D</Link></div>
        <p className="mt-4"><Link href="/podlahy" className="inline-flex items-center min-h-11 text-sm link">Katalog podlah</Link></p>
      </div>
    </Site>
  );
}
