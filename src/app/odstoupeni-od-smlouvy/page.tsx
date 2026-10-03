import type { Metadata } from "next";
import { LegalPage, Operator, type LegalSection } from "@/components/legal/LegalPage";
import { withdrawalForm } from "@/components/legal/withdrawalForm";
import { content as contentRepo, settings as settingsRepo } from "@/lib/db/repos";
import { fmtCzk } from "@/lib/format";
import { Download } from "@/components/ui/icons";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Odstoupení od smlouvy do 14 dnů",
  description: "Jak vrátit zboží z vinylpodlahy.cz do 14 dnů bez udání důvodu: postup, náklady na vrácení, vrácení peněz a vzorový formulář ke stažení.",
  alternates: { canonical: "/odstoupeni-od-smlouvy" },
};

export default function Page() {
  const c = contentRepo.get().contact;
  const s = settingsRepo.get();
  const f = withdrawalForm(c);
  const pallets = s.shipping.palletTiers.map((t) => `${t.label.toLowerCase()} ${fmtCzk(t.price)}`).join(", ");
  const sections: LegalSection[] = [
    {
      id: "pravo", title: "Právo odstoupit do 14 dnů",
      body: <>
        <p>Jako spotřebitel můžete od kupní smlouvy uzavřené přes e-shop odstoupit <strong>bez udání důvodu do 14 dnů</strong> (§ 1829 OZ). Lhůta běží od převzetí zboží; přišla-li objednávka ve <strong>více zásilkách</strong>, běží od převzetí poslední z nich. Odstoupit můžete i před převzetím zboží.</p>
        <p>Lhůta je zachována, pokud nám oznámení o odstoupení odešlete nejpozději poslední den lhůty.</p>
      </>,
    },
    {
      id: "jak", title: "Jak odstoupit",
      body: <>
        <ol>
          <li>Pošlete nám jednoznačné prohlášení — e-mailem na <a href={`mailto:${c.email}`}>{c.email}</a> nebo dopisem na adresu sídla. Můžete použít <a href="#formular">vzorový formulář</a>, není to ale povinné.</li>
          <li>Uveďte číslo objednávky, které zboží vracíte, a případně číslo účtu pro vrácení peněz. Přijetí odstoupení vám potvrdíme e-mailem.</li>
          <li><strong>Zboží neposílejte na adresu sídla bez domluvy.</strong> Zboží expeduje přímo dodavatel z jeho skladu — v potvrzení vám sdělíme adresu, kam zboží vrátit, případně nabídneme svoz.</li>
          <li>Zboží vraťte nejpozději <strong>do 14 dnů od odstoupení</strong>, ne na dobírku.</li>
        </ol>
        <Operator c={c} />
      </>,
    },
    {
      id: "naklady", title: "Náklady na vrácení zboží",
      body: <>
        <p>Přímé náklady na vrácení zboží nesete vy. Podlahy jsou těžké: zboží, které kvůli hmotnosti <strong>nelze vrátit běžnou poštou</strong>, se vrací paletovou přepravou. Náklady odhadujeme podle našeho ceníku: {pallets}. Balíkem do {s.shipping.parcelMaxKg} kg zpravidla do {fmtCzk(s.shipping.parcelPrice)} za balík.</p>
        <p>Můžete využít vlastního dopravce, nebo vám na vyžádání svoz zajistíme a jeho cenu odečteme od vracené částky.</p>
      </>,
    },
    {
      id: "vraceni-penez", title: "Vrácení peněz",
      body: <>
        <p>Do <strong>14 dnů od odstoupení</strong> vám vrátíme všechny přijaté peníze včetně nákladů na dodání ve výši nejlevnějšího nabízeného způsobu dopravy (příplatky nad něj, např. vynášku, nevracíme). Peníze vracíme stejným způsobem, jakým jste platili, tedy převodem, pokud se nedohodneme jinak.</p>
        <p>Peníze nejsme povinni vrátit dříve, než nám zboží vrátíte nebo prokážete, že jste ho odeslali.</p>
      </>,
    },
    {
      id: "stav-zbozi", title: "Stav vraceného zboží",
      body: <>
        <p>Zboží si můžete prohlédnout tak, jako v kamenném obchodě — otevřít balení a podívat se na dílce. Odpovídáte za snížení hodnoty zboží, které vznikne nakládáním nad tento rámec. Typicky jde o <strong>položené, lepené, řezané nebo jinak opracované dílce</strong>, poškozené obaly a znečištěné zboží; o takové snížení hodnoty můžeme snížit vracenou částku.</p>
        <p>Doporučujeme vracet zboží v původních, neporušených baleních.</p>
      </>,
    },
    {
      id: "vyjimky", title: "Kdy odstoupit nelze",
      body: <>
        <p>Podle § 1837 OZ nelze mimo jiné odstoupit od smlouvy o dodání:</p>
        <ul>
          <li>zboží, které bylo <strong>upraveno podle vašeho přání nebo pro vaši osobu</strong> (např. dílce řezané na míru, zakázková výroba, dekor objednaný speciálně pro vás, který běžně nenabízíme),</li>
          <li>zboží, které podléhá rychlé zkáze, nebo zboží, které bylo po dodání nenávratně smíseno s jiným zbožím,</li>
          <li>zboží v uzavřeném obalu, které z hygienických důvodů nelze vrátit, pokud jste obal porušili.</li>
        </ul>
        <p>Pokud by se na konkrétní zboží výjimka vztahovala, upozorníme vás na to před uzavřením smlouvy. Vzorky zdarma se nevracejí.</p>
        <p>Právo odstoupit do 14 dnů nemají kupující, kteří nakupují v rámci podnikání (s IČO).</p>
      </>,
    },
  ];
  return (
    <LegalPage href="/odstoupeni-od-smlouvy" title="Odstoupení od smlouvy" lead={<p>Zboží můžete vrátit do 14 dnů bez udání důvodu. Níže je postup a <a href="#formular">vzorový formulář</a>.</p>} sections={sections}>
      <section id="formular" className="scroll-mt-24 mt-12 panel">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="h3">Vzorový formulář</h2><p className="text-sm text-muted mt-1">{f.note}</p></div>
          <div className="flex flex-wrap gap-2">
            <a href="/odstoupeni-od-smlouvy/formular" target="_blank" rel="noopener" className="btn btn-outline btn-sm">Vytisknout</a>
            <a href="/odstoupeni-od-smlouvy/formular?format=txt" download className="btn btn-outline btn-sm"><Download className="h-4 w-4" /> Stáhnout</a>
          </div>
        </div>
        <div className="mt-5 text-sm leading-relaxed">
          <p className="font-medium">{f.title}</p>
          <p className="mt-2">{f.addressee}</p>
          <ul className="mt-3 space-y-3">{f.lines.map((l) => <li key={l} className="border-b border-line-strong pb-3">{l}</li>)}</ul>
          <p className="text-muted mt-3">{f.footnote}</p>
        </div>
      </section>
    </LegalPage>
  );
}
