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
      <div className="container py-10 md:py-14 max-w-3xl">
        <p className="eyebrow mb-3">Doprava a platba</p>
        <h1 className="h2">Dopravu počítáme z hmotnosti. Bez překvapení.</h1>
        <p className="lead mt-4">Podlaha je těžká: SPC váží 12–14 kg/m², vinyl na HDF 9–10 kg/m². Třicet metrů SPC je skoro 400 kg — to už není balík, ale paleta. Proto cenu dopravy vidíte už na kartě produktu a v košíku přesně podle toho, co v něm je.</p>
        <h2 className="h3 mt-12 mb-4">Ceník</h2>
        <table className="spec"><tbody>
          <tr><th>Balík do {s.shipping.parcelMaxKg} kg</th><td>{fmtCzk(s.shipping.parcelPrice)}</td></tr>
          <tr><th>Každý další balík</th><td>{fmtCzk(s.shipping.parcelAdditionalPrice)}</td></tr>
          {s.shipping.palletTiers.map((t) => <tr key={t.label}><th>{t.label} (nad {s.shipping.palletThresholdKg} kg jede paleta)</th><td>{fmtCzk(t.price)}</td></tr>)}
          <tr><th>Doprava zdarma</th><td>zásilka s {s.freeShippingFromM2} m² podlahy a více</td></tr>
          <tr><th>Vynáška — balík</th><td>{fmtCzk(s.shipping.carryUpParcelPrice)} / zásilka</td></tr>
          <tr><th>Vynáška — paleta</th><td>{fmtCzk(s.shipping.carryUpPalletPricePerFloor)} za každé patro (s výtahem jako 1 patro)</td></tr>
        </tbody></table>
        <h2 className="h3 mt-12 mb-3">Kam přesně zboží dovezeme</h2>
        <p className="text-ink-soft leading-relaxed"><strong className="text-ink">Ke krajnici / před dům, ne do bytu.</strong> Paletu řidič složí hydraulickou rukou nebo paletovým vozíkem na nejbližší zpevněné místo u domu. Pokud chcete zboží do patra nebo do bytu, zaškrtněte v košíku vynášku — je zpoplatněná, protože ji zajišťují dva lidé. Řidič vám před dodáním zavolá.</p>
        <h2 className="h3 mt-12 mb-3">Více dodavatelů = více zásilek</h2>
        <p className="text-ink-soft leading-relaxed">Zboží posílají naši velkoobchodní partneři přímo ze svých skladů. Když v košíku máte podlahu od jednoho a lišty od druhého, přijdou ve dvou zásilkách, každá s vlastní cenou dopravy a vlastním termínem. Rozdělení vidíte v košíku ještě před odesláním objednávky.</p>
        <h2 className="h3 mt-12 mb-3">Platba</h2>
        <p className="text-ink-soft leading-relaxed">Bankovním převodem po potvrzení dostupnosti (do 1 pracovního dne). Platbu kartou připravujeme.</p>
        <div className="mt-10 flex gap-3"><Link href="/kalkulacka" className="btn btn-primary">Spočítat projekt včetně dopravy</Link><Link href="/kontakt" className="btn btn-outline">Zeptat se</Link></div>
      </div>
    </Site>
  );
}
