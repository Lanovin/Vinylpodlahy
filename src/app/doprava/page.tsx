import type { Metadata } from "next";
import Link from "next/link";
import { Site } from "@/components/layout/Site";
import { settings as settingsRepo } from "@/lib/db/repos";
import { fmtCzk } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Doprava a platba", description: "Doprava podle hmotnosti: balík nebo paleta. Ke krajnici, vynáška jako příplatek. Doprava zdarma nad limit m²." };

export default function Page() {
  const s = settingsRepo.get();
  return (
    <Site>
      <div className="container py-8 md:py-14 max-w-3xl">
        <p className="eyebrow mb-3">Doprava a platba</p>
        <h1 className="h2">Dopravu počítáme z hmotnosti. Bez překvapení.</h1>
        <p className="lead mt-4">SPC váží 12–14 kg/m², takže 30 m² je skoro 400 kg — to už je paleta. Cenu dopravy proto vidíte už v kalkulačce a v košíku.</p>
        <h2 className="h3 mt-10 md:mt-12 mb-4">Ceník</h2>
        <table className="spec"><tbody>
          <tr><th>Balík do {s.shipping.parcelMaxKg} kg</th><td>{fmtCzk(s.shipping.parcelPrice)}</td></tr>
          <tr><th>Každý další balík</th><td>{fmtCzk(s.shipping.parcelAdditionalPrice)}</td></tr>
          {s.shipping.palletTiers.map((t) => <tr key={t.label}><th>{t.label}</th><td>{fmtCzk(t.price)}</td></tr>)}
          <tr><th>Doprava zdarma</th><td>zásilka s {s.freeShippingFromM2} m² podlahy a více</td></tr>
          <tr><th>Vynáška — balík</th><td>{fmtCzk(s.shipping.carryUpParcelPrice)} / zásilka</td></tr>
          <tr><th>Vynáška — paleta</th><td>{fmtCzk(s.shipping.carryUpPalletPricePerFloor)} za patro (s výtahem jako 1 patro)</td></tr>
        </tbody></table>
        <p className="text-sm text-muted mt-3">Nad {s.shipping.palletThresholdKg} kg jede zboží na paletě.</p>
        <h2 className="h3 mt-10 md:mt-12 mb-3">Kam přesně zboží dovezeme</h2>
        <p className="text-ink-soft leading-relaxed"><strong className="text-ink">Ke krajnici, ne do bytu.</strong> Do patra ho vyneseme za příplatek — stačí zaškrtnout vynášku v košíku. Řidič vám předem zavolá.</p>
        <h2 className="h3 mt-10 md:mt-12 mb-3">Více dodavatelů = více zásilek</h2>
        <p className="text-ink-soft leading-relaxed">Každý dodavatel posílá ze svého skladu, s vlastní cenou dopravy a termínem. Rozdělení vidíte v košíku ještě před objednáním.</p>
        <h2 className="h3 mt-10 md:mt-12 mb-3">Platba</h2>
        <p className="text-ink-soft leading-relaxed">Převodem, platební údaje pošleme do 1 pracovního dne. Zboží objednáme u dodavatele po připsání platby. Platbu kartou připravujeme.</p>
        <p className="text-sm text-muted mt-3">Podrobnosti v <Link href="/obchodni-podminky#dodani" className="link">obchodních podmínkách</Link>. Vrácení zboží do 14 dnů: <Link href="/odstoupeni-od-smlouvy" className="link">odstoupení od smlouvy</Link>.</p>
        <div className="mt-10 flex flex-wrap gap-3"><Link href="/kalkulacka" className="btn btn-primary">Spočítat cenu</Link><Link href="/kontakt" className="btn btn-outline">Zeptat se</Link></div>
      </div>
    </Site>
  );
}
