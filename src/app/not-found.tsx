import Link from "next/link";
import { Site } from "@/components/layout/Site";

export default function NotFound() {
  return (
    <Site>
      <div className="container py-32 text-center">
        <p className="eyebrow mb-3">404</p>
        <h1 className="h2">Tuhle stránku jsme nenašli.</h1>
        <p className="lead mt-4">Podlahu ale najdeme. Zkuste katalog nebo průvodce výběrem.</p>
        <div className="mt-8 flex justify-center gap-3"><Link href="/podlahy" className="btn btn-primary">Katalog podlah</Link><Link href="/kalkulacka" className="btn btn-outline">Spočítat projekt</Link></div>
      </div>
    </Site>
  );
}
