import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, Operator, type LegalSection } from "@/components/legal/LegalPage";
import { content as contentRepo } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Ochrana osobních údajů",
  description: "Jak vinylpodlahy.cz zpracovává osobní údaje: objednávky, vzorky zdarma, poptávky pokládky, kalkulace, e-maily se souhlasem a cookies. Vaše práva podle GDPR.",
  alternates: { canonical: "/ochrana-osobnich-udaju" },
};

/** Jeden účel zpracování: co, proč (právní základ) a jak dlouho. */
function Purpose({ title, data, basis, retention, children }: { title: string; data: string; basis: React.ReactNode; retention: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="card p-4 mt-4">
      <h3 className="!mt-0">{title}</h3>
      {children}
      <dl className="mt-3 grid sm:grid-cols-[9rem_minmax(0,1fr)] gap-x-4 gap-y-1 text-sm">
        <dt className="text-muted">Údaje</dt><dd>{data}</dd>
        <dt className="text-muted">Právní základ</dt><dd>{basis}</dd>
        <dt className="text-muted">Jak dlouho</dt><dd>{retention}</dd>
      </dl>
    </div>
  );
}

export default function Page() {
  const c = contentRepo.get().contact;
  const sections: LegalSection[] = [
    {
      id: "spravce", title: "Kdo vaše údaje zpracovává",
      body: <>
        <p>Správcem osobních údajů je provozovatel e-shopu vinylpodlahy.cz. Pověřence pro ochranu osobních údajů jsme nejmenovali; ve všech otázkách nám napište na <a href={`mailto:${c.email}`}>{c.email}</a>.</p>
        <Operator c={c} role="Správce" />
        <p>Údaje zpracováváme podle nařízení (EU) 2016/679 (GDPR) a zákona č. 110/2019 Sb., o zpracování osobních údajů. Získáváme je přímo od vás — z formulářů na webu, e-mailu a telefonu.</p>
      </>,
    },
    {
      id: "ucely", title: "Proč a jak dlouho údaje zpracováváme",
      body: <>
        <Purpose title="Objednávka a doručení zboží" data="jméno, e-mail, telefon, dodací adresa, u firmy název, IČO a DIČ, obsah objednávky, poznámka pro řidiče" basis={<>plnění smlouvy (čl. 6 odst. 1 písm. b GDPR); účetní a daňové povinnosti (písm. c)</>} retention={<>po dobu vyřizování objednávky a záruky; účetní doklady 10 let (zákon o DPH, zákon o účetnictví); údaje pro obranu nároků do konce promlčecí lhůty, obvykle 4 roky od dodání</>}>
          <p>Bez těchto údajů objednávku nelze přijmout ani doručit.</p>
        </Purpose>
        <Purpose title="Vzorky zdarma" data="jméno, e-mail, poštovní adresa, vybrané dekory, případně odkaz na kalkulaci" basis={<>plnění smlouvy na vaši žádost — zaslání vzorků (čl. 6 odst. 1 písm. b GDPR); souhlas nepotřebujeme</>} retention="12 měsíců od odeslání vzorků" />
        <Purpose title="E-maily s radami k výběru a slevou" data="e-mail, jméno, vybrané dekory, odkaz na kalkulaci" basis={<><strong>souhlas</strong> (čl. 6 odst. 1 písm. a GDPR) — nepovinné zaškrtávací pole u vzorků. Souhlas můžete kdykoli odvolat odkazem „Odhlásit“ v každém e-mailu nebo napsáním na náš e-mail.</>} retention="do odvolání souhlasu, nejdéle 2 roky od udělení; záznam o udělení a odvolání souhlasu uchováváme po dobu promlčecí lhůty jako doklad" />
        <Purpose title="Poptávka pokládky" data="PSČ, plocha, termín, jméno, telefon, e-mail, poznámka, případně vybraná podlaha a kalkulace" basis={<>opatření před uzavřením smlouvy na vaši žádost (čl. 6 odst. 1 písm. b GDPR) — poptávku předáme spolupracujícímu podlaháři ve vašem okolí</>} retention="12 měsíců od poptávky, pokud z ní nevznikne objednávka" />
        <Purpose title="Uložené kalkulace" data="rozměry místností, odpovědi v kalkulačce, vybraná podlaha; e-mail jen pokud si kalkulaci necháte poslat" basis={<>plnění na vaši žádost (čl. 6 odst. 1 písm. b GDPR). Kalkulace je dostupná pod náhodně vygenerovaným odkazem a sama o sobě osobní údaje neobsahuje; e-mailovou adresu použijeme jen k jejímu odeslání.</>} retention="kalkulace 24 měsíců od uložení; e-mail pro odeslání kalkulace 12 měsíců" />
        <Purpose title="Komunikace se zákazníky" data="údaje, které nám pošlete e-mailem nebo sdělíte telefonicky" basis={<>oprávněný zájem odpovědět na dotaz (čl. 6 odst. 1 písm. f GDPR), případně plnění smlouvy</>} retention="12 měsíců od vyřízení dotazu, u reklamací po dobu záruky a promlčecí lhůty" />
        <Purpose title="Statistiky návštěvnosti a měření reklam (cookies)" data="identifikátory cookies, zkrácená IP adresa, údaje o zařízení a prohlížeči, navštívené stránky, zdroj návštěvy" basis={<><strong>souhlas</strong> v cookie liště (§ 89 odst. 3 zákona o elektronických komunikacích, čl. 6 odst. 1 písm. a GDPR); nezbytné cookies bez souhlasu</>} retention={<>podle typu cookie, viz <Link href="/cookies">Zásady cookies</Link>; data v Google Analytics 14 měsíců</>} />
      </>,
    },
    {
      id: "prijemci", title: "Komu údaje předáváme",
      body: <>
        <p>Údaje nikomu neprodáváme. Předáváme je jen tomu, kdo je potřebuje pro daný účel:</p>
        <ul>
          <li><strong>dodavatelům zboží</strong> (velkoobchodním partnerům), kteří objednané zboží expedují přímo k vám — jméno, dodací adresa, telefon a obsah zásilky,</li>
          <li><strong>dopravcům</strong> (balíkové a paletové přepravě) — jméno, adresa, telefon, případně e-mail pro avízo doručení,</li>
          <li><strong>podlahaři</strong>, kterému předáme vaši poptávku pokládky (jen pokud ji odešlete),</li>
          <li>poskytovatelům služeb, kteří pro nás údaje zpracovávají jako zpracovatelé: hosting webu, rozesílání e-mailů, účetní a IT podpora,</li>
          <li><strong>Google Ireland Ltd.</strong> (Google Tag Manager, Google Analytics, Google Ads) — jen se souhlasem v cookie liště,</li>
          <li>orgánům veřejné moci, pokud nám to ukládá zákon.</li>
        </ul>
        <p>Údaje zpracováváme v EU. Některé služby Google mohou údaje předávat do USA; přenos se řídí rozhodnutím Evropské komise o odpovídající ochraně (EU-US Data Privacy Framework), případně standardními smluvními doložkami.</p>
      </>,
    },
    {
      id: "prava", title: "Vaše práva",
      body: <>
        <p>Máte právo:</p>
        <ul>
          <li>na <strong>přístup</strong> k údajům a jejich kopii,</li>
          <li>na <strong>opravu</strong> nepřesných údajů,</li>
          <li>na <strong>výmaz</strong>, pokud je už nepotřebujeme nebo jste odvolali souhlas (neplatí pro údaje, které musíme uchovávat ze zákona),</li>
          <li>na <strong>omezení zpracování</strong>,</li>
          <li>na <strong>přenositelnost</strong> údajů, které zpracováváme na základě smlouvy nebo souhlasu,</li>
          <li>vznést <strong>námitku</strong> proti zpracování na základě oprávněného zájmu,</li>
          <li><strong>kdykoli odvolat souhlas</strong> — odkazem v e-mailu, v nastavení cookies (<Link href="/cookies">Zásady cookies</Link>) nebo e-mailem; zpracování do odvolání zůstává zákonné,</li>
          <li>podat <strong>stížnost</strong> u Úřadu pro ochranu osobních údajů, Pplk. Sochora 27, 170 00 Praha 7, <a href="https://uoou.gov.cz" target="_blank" rel="noopener noreferrer">uoou.gov.cz</a>.</li>
        </ul>
        <p>Žádost pošlete na <a href={`mailto:${c.email}`}>{c.email}</a>. Vyřídíme ji bezplatně do 1 měsíce; abychom údaje nepředali cizí osobě, můžeme ověřit vaši totožnost.</p>
      </>,
    },
    {
      id: "zabezpeceni", title: "Zabezpečení a automatizované rozhodování",
      body: <>
        <p>Údaje chráníme technickými a organizačními opatřeními: šifrované spojení (HTTPS), přístup jen pro oprávněné osoby, zabezpečená administrace a smluvně zavázaní zpracovatelé.</p>
        <p>Nedochází k automatizovanému rozhodování ani profilování s právními účinky. Doporučení podlah v kalkulačce vychází jen z vašich odpovědí a parametrů výrobků.</p>
      </>,
    },
  ];
  return <LegalPage href="/ochrana-osobnich-udaju" title="Ochrana osobních údajů" lead={<p>Shrnutí: údaje používáme jen k vyřízení toho, o co nás požádáte (objednávka, vzorky, poptávka pokládky). E-maily s radami a slevou a měřicí cookies jen s vaším souhlasem, který můžete kdykoli odvolat.</p>} sections={sections} />;
}
