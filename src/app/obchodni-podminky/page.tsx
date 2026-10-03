import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Operator, type LegalSection } from "@/components/legal/LegalPage";
import { content as contentRepo, settings as settingsRepo } from "@/lib/db/repos";
import { fmtCzk } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Obchodní podmínky",
  description: "Obchodní podmínky e-shopu vinylpodlahy.cz: objednávka, ceny vč. DPH, platba převodem, dodání ve více zásilkách, odstoupení od smlouvy, reklamace a mimosoudní řešení sporů.",
  alternates: { canonical: "/obchodni-podminky" },
};

export default function Page() {
  const c = contentRepo.get().contact;
  const s = settingsRepo.get();
  const sections: LegalSection[] = [
    {
      id: "uvod", title: "Úvodní ustanovení",
      body: <>
        <p>Tyto obchodní podmínky upravují vztahy mezi prodávajícím a kupujícím při nákupu zboží přes internetový obchod na adrese vinylpodlahy.cz (dále „e-shop“). Řídí se zejména zákonem č. 89/2012 Sb., občanský zákoník (dále „OZ“), a zákonem č. 634/1992 Sb., o ochraně spotřebitele.</p>
        <Operator c={c} />
        <p><strong>Spotřebitel</strong> je člověk, který nakupuje mimo rámec své podnikatelské činnosti. <strong>Podnikatel</strong> je kupující, který nakupuje v rámci svého podnikání (např. s uvedením IČO). Ustanovení o ochraně spotřebitele (zejména odstoupení do 14 dnů a lhůty pro reklamace) platí jen pro spotřebitele; pro podnikatele platí OZ bez nich, pokud se strany nedohodnou jinak.</p>
        <p>Odchylná ujednání ve smlouvě mají přednost před těmito podmínkami. Smlouva se uzavírá v českém jazyce.</p>
      </>,
    },
    {
      id: "zbozi-a-ceny", title: "Zboží a ceny",
      body: <>
        <p>U každého zboží uvádíme hlavní vlastnosti, cenu za m² i za balení, dostupnost v m² a orientační dodací lhůtu. Fotografie dekorů a interiérů jsou ilustrační — barva se na displeji může lišit, proto nabízíme vzorky zdarma.</p>
        <p>Všechny ceny jsou konečné, uvedené v Kč <strong>včetně DPH</strong>. Cenu dopravy, případné vynášky a rozdělení do zásilek vidíte v košíku a v pokladně ještě před odesláním objednávky. Jiné poplatky neúčtujeme.</p>
        <p>Ceny se mohou měnit podle cen dodavatelů. Pro kupujícího platí cena uvedená v okamžiku odeslání objednávky. Pokud dojde ke zjevné chybě v ceně (např. překlep v řádu), nejde o platnou nabídku a objednávku s takovou cenou nepotvrdíme.</p>
      </>,
    },
    {
      id: "objednavka", title: "Objednávka a uzavření smlouvy",
      body: <>
        <ol>
          <li>Zboží vložíte do košíku (ručně nebo z kalkulačky), v pokladně vyplníte dodací údaje a zkontrolujete souhrn: zboží, zásilky, dopravu, termíny a cenu celkem. Až do odeslání můžete vše měnit a opravovat.</li>
          <li>Objednávku odešlete tlačítkem <strong>„Objednat s povinností platby“</strong>. Předtím musíte potvrdit, že jste se seznámili s těmito podmínkami.</li>
          <li>Po odeslání zobrazíme rekapitulaci a pošleme e-mail s přijetím objednávky. <strong>Kupní smlouva vzniká</strong> potvrzením objednávky z naší strany (e-mail s platebními údaji), zpravidla do 1 pracovního dne.</li>
          <li>Objednávku můžeme odmítnout nebo s vámi dohodnout změnu, pokud zboží mezitím přestal dodavatel nabízet, výrazně se změnila jeho cena nebo nejsou objednávkové údaje úplné. O tom vás bez zbytečného odkladu informujeme; případnou platbu vrátíme.</li>
          <li>Uzavřenou smlouvu archivujeme v elektronické podobě; na vyžádání vám ji pošleme. Náklady na komunikaci na dálku (internet, telefon) nese kupující a neliší se od běžné sazby.</li>
        </ol>
      </>,
    },
    {
      id: "platba", title: "Platební podmínky",
      body: <>
        <p>Platí se <strong>bankovním převodem</strong> předem. Číslo účtu, variabilní symbol a částku pošleme v potvrzení objednávky. Kupní cena je splatná do 7 dnů od potvrzení objednávky; zaplaceno je připsáním částky na náš účet.</p>
        <p>Zboží objednáváme u dodavatele až po připsání platby — od té doby běží dodací lhůty. Pokud cena není zaplacena ani do 7 dnů po splatnosti, můžeme od smlouvy odstoupit; o tom vás informujeme e-mailem.</p>
        <p>Daňový doklad (fakturu) vystavíme po zaplacení a pošleme e-mailem. Při nákupu na firmu uveďte v pokladně IČO a případně DIČ.</p>
      </>,
    },
    {
      id: "dodani", title: "Dodání zboží",
      body: <>
        <p><strong>Zboží neodesíláme z vlastního skladu.</strong> Expeduje ho přímo náš smluvní dodavatel (velkoobchod) ze svého skladu na vaši adresu. Pokud objednávka obsahuje zboží od více dodavatelů, <strong>přijde ve více zásilkách</strong> — každá má vlastní cenu dopravy a termín. Rozdělení vidíte v košíku i v pokladně ještě před objednáním.</p>
        <ul>
          <li><strong>Způsob přepravy</strong> se řídí hmotností zásilky: balík do {s.shipping.parcelMaxKg} kg, nad {s.shipping.palletThresholdKg} kg paleta. Ceník je na stránce <Link href="/doprava">Doprava a platba</Link>. Zásilka s alespoň {s.freeShippingFromM2} m² podlahy jede zdarma.</li>
          <li><strong>Místo dodání:</strong> balík ke dveřím domu, paleta ke krajnici / před dům, kam může vozidlo bezpečně zajet. Vynáška do patra je příplatková služba ({fmtCzk(s.shipping.carryUpParcelPrice)} za balíkovou zásilku, {fmtCzk(s.shipping.carryUpPalletPricePerFloor)} za patro u palety), kterou si objednáte v košíku.</li>
          <li><strong>Termín:</strong> uvedené lhůty jsou v pracovních dnech od připsání platby a jsou orientační podle údajů dodavatele. Řidič vás před doručením kontaktuje telefonicky. Pokud by se termín výrazně prodloužil, ozveme se a můžete od objednávky odstoupit.</li>
          <li><strong>Převzetí:</strong> zásilku při převzetí zkontrolujte. Je-li obal nebo paleta zjevně poškozena, uveďte to do předávacího protokolu dopravce, zásilku nafoťte, případně ji odmítněte převzít, a dejte nám hned vědět. Pozdější uplatnění vad tím není dotčeno.</li>
          <li>Pokud zásilku z důvodů na vaší straně nepřevezmete, můžeme požadovat náhradu nákladů na opakované doručení nebo na vrácení zásilky dodavateli.</li>
        </ul>
      </>,
    },
    {
      id: "riziko", title: "Přechod nebezpečí škody a vlastnického práva",
      body: <>
        <p>Nebezpečí škody na zboží přechází na kupujícího <strong>převzetím zboží</strong> (u spotřebitele převzetím od dopravce). Vlastnické právo přechází zaplacením kupní ceny a převzetím zboží, podle toho, co nastane později.</p>
      </>,
    },
    {
      id: "vady", title: "Vady zboží a záruka",
      body: <>
        <p>Odpovídáme za to, že zboží při převzetí nemá vady — má sjednané vlastnosti, hodí se k účelu uvedenému výrobcem, odpovídá množství a popisu a splňuje právní předpisy. Spotřebitel může vady uplatnit do <strong>24 měsíců od převzetí</strong>. Projeví-li se vada během prvního roku, má se za to, že zboží bylo vadné už při převzetí.</p>
        <p>Pokud výrobce poskytuje delší záruku za jakost, uvádíme ji u produktu nebo v přiloženém záručním listu; řídí se podmínkami výrobce.</p>
        <p>Odpovědnost za vady se nevztahuje na běžné opotřebení, poškození nevhodným používáním nebo údržbou a na vady způsobené pokládkou v rozporu s návodem výrobce (např. bez aklimatizace, na nevhodný či vlhký podklad, bez dilatačních spár). Před pokládkou proto doporučujeme dílce zkontrolovat; zjevně poškozené nepokládejte a reklamujte je.</p>
        <p>Postup reklamace, lhůty a vaše práva podrobně popisuje <Link href="/reklamacni-rad">Reklamační řád</Link>.</p>
      </>,
    },
    {
      id: "odstoupeni", title: "Odstoupení od smlouvy",
      body: <>
        <p>Spotřebitel může od smlouvy uzavřené přes e-shop odstoupit bez udání důvodu <strong>do 14 dnů od převzetí zboží</strong> (u objednávky doručené ve více zásilkách od převzetí poslední z nich). Postup, náklady na vrácení zboží a vzorový formulář jsou na stránce <Link href="/odstoupeni-od-smlouvy">Odstoupení od smlouvy</Link>.</p>
        <p>Odstoupit nelze mimo jiné u zboží upraveného podle vašeho přání nebo pro vaši osobu (§ 1837 OZ).</p>
        <p>Prodávající může od smlouvy odstoupit, pokud zboží nelze dodat (např. jej dodavatel přestal vyrábět nebo dodávat) nebo pokud kupující nezaplatí; přijatou platbu vrátíme do 14 dnů.</p>
      </>,
    },
    {
      id: "sluzby", title: "Vzorky zdarma, kalkulace a pokládka",
      body: <>
        <ul>
          <li><strong>Vzorky zdarma</strong> posíláme bezplatně a nemusíte je vracet. Na vzorky se nevztahují ustanovení o kupní smlouvě a nezakládají povinnost nic koupit.</li>
          <li><strong>Kalkulace</strong> (množství balení, příslušenství, dopravy) je orientační pomůcka vycházející z vámi zadaných rozměrů. Za správnost zadaných rozměrů odpovídá kupující; před objednáním doporučujeme změřit místnosti znovu.</li>
          <li><strong>Pokládku</strong> neprovádíme. Na vaši žádost předáme poptávku spolupracujícímu podlaháři, který vám pošle vlastní nabídku. Smlouva o pokládce vzniká přímo mezi vámi a podlahářem.</li>
        </ul>
      </>,
    },
    {
      id: "spory", title: "Stížnosti a mimosoudní řešení sporů",
      body: <>
        <p>Stížnosti a dotazy vyřizujeme na e-mailu <a href={`mailto:${c.email}`}>{c.email}</a> nebo na telefonu {c.phone}.</p>
        <p>K mimosoudnímu řešení spotřebitelských sporů je příslušná <strong>Česká obchodní inspekce</strong>, Ústřední inspektorát — oddělení ADR, Gorazdova 1969/24, 120 00 Praha 2, <a href="https://adr.coi.cz" target="_blank" rel="noopener noreferrer">adr.coi.cz</a>. Návrh lze podat nejpozději do 1 roku ode dne, kdy jste u nás právo poprvé uplatnili.</p>
        <p>Evropská platforma pro řešení sporů online (ODR) byla k 20. 7. 2025 zrušena (nařízení EU 2024/3228). U přeshraničních sporů pomůže <strong>Evropské spotřebitelské centrum ČR</strong> (<a href="https://www.evropskyspotrebitel.cz" target="_blank" rel="noopener noreferrer">evropskyspotrebitel.cz</a>).</p>
        <p>Dozor nad dodržováním povinností prodávajícího vykonává Česká obchodní inspekce (<a href="https://www.coi.cz" target="_blank" rel="noopener noreferrer">coi.cz</a>), v oblasti ochrany osobních údajů Úřad pro ochranu osobních údajů a v rozsahu živnostenského oprávnění příslušný živnostenský úřad.</p>
      </>,
    },
    {
      id: "osobni-udaje", title: "Osobní údaje",
      body: <p>Osobní údaje zpracováváme v souladu s nařízením GDPR. Podrobnosti najdete v <Link href="/ochrana-osobnich-udaju">zásadách ochrany osobních údajů</Link> a <Link href="/cookies">zásadách cookies</Link>.</p>,
    },
    {
      id: "zaver", title: "Závěrečná ustanovení",
      body: <>
        <p>Vztahy neupravené těmito podmínkami se řídí právním řádem České republiky, zejména OZ a zákonem o ochraně spotřebitele. Volba práva nezbavuje spotřebitele ochrany, kterou mu poskytují kogentní předpisy státu jeho bydliště.</p>
        <p>Podmínky můžeme měnit; na již uzavřené smlouvy se vždy použije znění účinné v době odeslání objednávky.</p>
      </>,
    },
  ];
  return <LegalPage href="/obchodni-podminky" title="Obchodní podmínky" sections={sections} />;
}
