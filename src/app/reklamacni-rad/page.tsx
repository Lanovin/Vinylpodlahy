import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Operator, type LegalSection } from "@/components/legal/LegalPage";
import { content as contentRepo } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Reklamační řád",
  description: "Jak reklamovat vinylovou nebo SPC podlahu a příslušenství z vinylpodlahy.cz: lhůta 24 měsíců, postup, vyřízení do 30 dnů, poškození při přepravě.",
  alternates: { canonical: "/reklamacni-rad" },
};

export default function Page() {
  const c = contentRepo.get().contact;
  const sections: LegalSection[] = [
    {
      id: "uvod", title: "Úvod",
      body: <>
        <p>Reklamační řád popisuje, jak uplatnit práva z vadného plnění (reklamaci) u zboží koupeného na vinylpodlahy.cz. Vychází z § 2099 a násl. a § 2158 a násl. občanského zákoníku a ze zákona o ochraně spotřebitele. Je součástí <Link href="/obchodni-podminky">obchodních podmínek</Link>.</p>
        <Operator c={c} />
      </>,
    },
    {
      id: "odpovednost", title: "Za co odpovídáme",
      body: <>
        <p>Odpovídáme, že zboží při převzetí nemá vady, zejména že:</p>
        <ul>
          <li>má vlastnosti, které jsme popsali nebo které výrobce uvádí (rozměr, tloušťka, nášlapná vrstva, třída zátěže, typ zámku…),</li>
          <li>hodí se k účelu, který výrobce uvádí (např. na podlahové topení, do vlhkých prostor),</li>
          <li>je v odpovídajícím množství a balení,</li>
          <li>vyhovuje požadavkům právních předpisů.</li>
        </ul>
        <p>Spotřebitel může vadu vytknout do <strong>24 měsíců od převzetí</strong> zboží. Projeví-li se vada v prvních 12 měsících, má se za to, že zboží bylo vadné už při převzetí, ledaže to povaha věci nebo vady vylučuje.</p>
      </>,
    },
    {
      id: "na-co-ne", title: "Co není vadou",
      body: <>
        <ul>
          <li>běžné opotřebení odpovídající délce a intenzitě používání,</li>
          <li>poškození mechanické (poškrábání, otlaky od nábytku bez podložek), chemické nebo ohněm po převzetí,</li>
          <li>vady způsobené pokládkou v rozporu s návodem výrobce — např. bez aklimatizace dílců, na vlhký, nerovný nebo nevhodný podklad, bez dilatačních spár, s nevhodnou podložkou nebo lepidlem,</li>
          <li>nevhodná údržba (agresivní čisticí prostředky, stojící voda u podlah, které nejsou voděodolné),</li>
          <li>drobné odchylky odstínu a kresby mezi výrobními šaržemi a oproti fotografii či vzorku, které jsou u dekorů přirozené. Doporučujeme objednat celé množství najednou.</li>
        </ul>
      </>,
    },
    {
      id: "pred-pokladkou", title: "Kontrola při převzetí a před pokládkou",
      body: <>
        <p><strong>Při převzetí</strong> zkontrolujte počet kusů a stav obalů. Poškození při přepravě zapište do předávacího protokolu dopravce, zásilku nafoťte (i paletu z více stran) a dejte nám vědět do 2 pracovních dnů — urychlí to vyřízení s dopravcem. Vaše práva z vad tím nejsou omezena.</p>
        <p><strong>Před pokládkou</strong> dílce zkontrolujte (rozměr, zámky, odstín, poškození). Zjevně vadné dílce nepokládejte a reklamujte je — u položené podlahy se vada hůře prokazuje a její odstranění je pro obě strany nákladnější.</p>
      </>,
    },
    {
      id: "jak-reklamovat", title: "Jak reklamovat",
      body: <>
        <ol>
          <li>Napište na <a href={`mailto:${c.email}`}>{c.email}</a> (nebo zavolejte na {c.phone}) a uveďte <strong>číslo objednávky</strong>, co reklamujete, popis vady, kdy se projevila, a jaké řešení požadujete.</li>
          <li>Přiložte <strong>fotografie</strong> vady a štítku balení (číslo šarže). U položené podlahy i fotografii celé plochy a podkladu, pokud je to možné.</li>
          <li><strong>Zboží neposílejte bez domluvy</strong> — expeduje ho přímo dodavatel z jeho skladu. Řekneme vám, zda a kam zboží předat, případně zajistíme svoz na naše náklady.</li>
        </ol>
        <p>Uplatnění reklamace vám potvrdíme e-mailem (datum, obsah reklamace a požadovaný způsob vyřízení). Po vyřízení obdržíte potvrzení o datu a způsobu vyřízení, případně odůvodnění zamítnutí.</p>
      </>,
    },
    {
      id: "prava", title: "Vaše práva při vadě",
      body: <>
        <ul>
          <li>Můžete požadovat <strong>odstranění vady opravou nebo výměnou</strong> (u podlah zpravidla dodáním nových dílců stejné šarže, je-li k dispozici). Volbu můžeme odmítnout, je-li zvolený způsob nemožný nebo nepřiměřeně nákladný ve srovnání s druhým.</li>
          <li><strong>Přiměřenou slevu</strong> nebo <strong>odstoupení od smlouvy</strong> můžete požadovat, pokud vadu odmítneme odstranit nebo ji neodstraníme včas či bez značných obtíží, pokud se vada projeví opakovaně, je-li vada podstatným porušením smlouvy, nebo je-li zřejmé, že ji neodstraníme. Pro nevýznamnou vadu od smlouvy odstoupit nelze.</li>
          <li>Máte právo na náhradu účelně vynaložených nákladů spojených s oprávněnou reklamací (např. doprava).</li>
        </ul>
      </>,
    },
    {
      id: "lhuty", title: "Lhůta pro vyřízení",
      body: <p>Reklamaci spotřebitele vyřídíme bez zbytečného odkladu, <strong>nejpozději do 30 dnů</strong> od jejího uplatnění, včetně případného odborného posouzení. Delší lhůtu je možné jen písemně dohodnout. Nevyřídíme-li reklamaci včas, máte stejná práva jako při podstatném porušení smlouvy.</p>,
    },
    {
      id: "podnikatele", title: "Kupující podnikatelé",
      body: <p>U kupujících, kteří nakupují v rámci podnikání (s IČO), se práva z vadného plnění řídí § 2099 až 2117 OZ. Vadu je třeba vytknout bez zbytečného odkladu poté, co ji kupující mohl při včasné prohlídce zjistit, a lhůta 30 dnů pro vyřízení se neuplatní; reklamaci vyřídíme v přiměřené době.</p>,
    },
    {
      id: "spory", title: "Mimosoudní řešení",
      body: <p>Nejste-li s vyřízením spokojeni, můžete se obrátit na Českou obchodní inspekci jako subjekt mimosoudního řešení spotřebitelských sporů (<a href="https://adr.coi.cz" target="_blank" rel="noopener noreferrer">adr.coi.cz</a>). Podrobnosti v <Link href="/obchodni-podminky#spory">obchodních podmínkách</Link>.</p>,
    },
  ];
  return <LegalPage href="/reklamacni-rad" title="Reklamační řád" sections={sections} />;
}
