import { settings } from "@/lib/db/repos";
import { Card, PageHead, Saved } from "@/components/admin/ui";
import { saveSettingsAction } from "../../actions";

function N({ name, label, value, hint }: { name: string; label: string; value: number; hint?: string }) {
  return <div><label className="label" htmlFor={name}>{label}</label><input id={name} name={name} className="input" defaultValue={value} inputMode="decimal" />{hint && <p className="text-xs text-muted mt-1">{hint}</p>}</div>;
}

export default async function Page({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const s = settings.get();
  const { saved } = await searchParams;
  return (
    <>
      <PageHead title="Nastavení" text="Pojistky pipeline, doprava a vzorky. DPH je pevně 21 %." />
      <Saved show={!!saved} />
      <form action={saveSettingsAction} className="space-y-4">
        <Card><h2 className="text-lg mb-4">Pojistky feedu</h2><div className="grid md:grid-cols-3 gap-4">
          <N name="priceJumpAlertPct" label="Skok nákupní ceny → pozastavit (%)" value={s.priceJumpAlertPct} hint="Výchozí 10 %. Nikdy neprodávat za starou cenu." />
          <N name="stockSafetyPct" label="Bezpečnostní rezerva dostupnosti (%)" value={s.stockSafetyPct} hint="Z 40 m² u dodavatele prodáváme max 36 m²." />
        </div></Card>
        <Card><h2 className="text-lg mb-4">Doprava</h2><div className="grid md:grid-cols-3 gap-4">
          <N name="freeShippingFromM2" label="Doprava zdarma od (m² v zásilce)" value={s.freeShippingFromM2} />
          <N name="parcelMaxKg" label="Max. hmotnost balíku (kg)" value={s.shipping.parcelMaxKg} />
          <N name="palletThresholdKg" label="Od kolika kg jede paleta" value={s.shipping.palletThresholdKg} />
          <N name="parcelPrice" label="Cena balíku (Kč)" value={s.shipping.parcelPrice} />
          <N name="parcelAdditionalPrice" label="Každý další balík (Kč)" value={s.shipping.parcelAdditionalPrice} />
          <div />
          {s.shipping.palletTiers.map((t, i) => <div key={i} className="grid grid-cols-2 gap-2"><N name={`tier.${i}.maxKg`} label={`Paleta ${i + 1} — do kg`} value={Number.isFinite(t.maxKg) ? t.maxKg : 99999} /><N name={`tier.${i}.price`} label="cena Kč" value={t.price} /></div>)}
          <N name="carryUpParcelPrice" label="Vynáška — balík (Kč)" value={s.shipping.carryUpParcelPrice} />
          <N name="carryUpPalletPricePerFloor" label="Vynáška — paleta, za patro (Kč)" value={s.shipping.carryUpPalletPricePerFloor} />
        </div></Card>
        <Card><h2 className="text-lg mb-4">Odhad hmotnosti, když ji feed neposlal (kg/m²)</h2><div className="grid md:grid-cols-4 gap-4">
          <N name="w.spc" label="SPC" value={s.weightEstimateKgPerM2.spc} /><N name="w.vinyl-hdf" label="Vinyl na HDF" value={s.weightEstimateKgPerM2["vinyl-hdf"]} /><N name="w.vinyl-composite" label="Vinyl na kompozitu" value={s.weightEstimateKgPerM2["vinyl-composite"]} /><N name="w.vinyl-glue" label="Lepený vinyl" value={s.weightEstimateKgPerM2["vinyl-glue"]} />
        </div></Card>
        <Card><h2 className="text-lg mb-4">Vzorky</h2><div className="grid md:grid-cols-3 gap-4"><N name="samples.min" label="Minimum vzorků" value={s.samples.min} /><N name="samples.max" label="Maximum vzorků" value={s.samples.max} /></div></Card>
        <button className="btn btn-primary btn-lg">Uložit nastavení</button>
      </form>
    </>
  );
}
