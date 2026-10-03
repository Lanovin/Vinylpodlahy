import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, type LegalSection } from "@/components/legal/LegalPage";
import { CookieSettingsButton } from "@/components/layout/CookieBanner";
import { CONSENT_CATEGORIES, CONSENT_MAX_AGE } from "@/lib/consent";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Zásady cookies",
  description: "Jaké cookies používá vinylpodlahy.cz: nezbytné, analytické (Google Analytics) a marketingové (Google Ads). Jak souhlas udělit, změnit nebo odvolat.",
  alternates: { canonical: "/cookies" },
};

const TYPE_LABEL = { cookie: "cookie", localStorage: "úložiště prohlížeče", sessionStorage: "úložiště relace" } as const;

export default function Page() {
  const months = Math.round(CONSENT_MAX_AGE / (60 * 60 * 24 * 30.4));
  const sections: LegalSection[] = [
    {
      id: "co-to-je", title: "Co jsou cookies",
      body: <p>Cookies jsou malé textové soubory, které web ukládá do vašeho prohlížeče. Podobně fungují i úložiště prohlížeče (localStorage, sessionStorage). Některé jsou nutné, aby web fungoval (např. košík), jiné slouží ke statistikám nebo měření reklam — ty používáme <strong>jen s vaším souhlasem</strong>.</p>,
    },
    {
      id: "kategorie", title: "Jaké cookies používáme",
      body: <>
        {CONSENT_CATEGORIES.map((cat) => (
          <div key={cat.key} className="mt-6">
            <h3 className="!mt-0">{cat.title}</h3>
            <p className="!mt-1">{cat.text} <span className="text-muted">{cat.legal}</span></p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border-collapse min-w-[32rem]">
                <thead><tr className="text-left text-muted border-b border-line-strong"><th className="py-2 pr-3 font-normal">Název</th><th className="py-2 pr-3 font-normal">Poskytovatel</th><th className="py-2 pr-3 font-normal">Účel</th><th className="py-2 font-normal">Platnost</th></tr></thead>
                <tbody>
                  {cat.items.map((it) => (
                    <tr key={it.name} className="border-b border-line align-top">
                      <td className="py-2 pr-3"><code className="text-[.85em]">{it.name}</code><span className="block text-xs text-muted">{TYPE_LABEL[it.type]}</span></td>
                      <td className="py-2 pr-3">{it.provider}</td>
                      <td className="py-2 pr-3">{it.purpose}</td>
                      <td className="py-2 whitespace-nowrap">{it.expiry}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
        <p className="mt-6">Konkrétní názvy cookies třetích stran se mohou měnit podle nastavení jejich poskytovatele (Google). Aktuální přehled Google: <a href="https://business.safety.google/adscookies/" target="_blank" rel="noopener noreferrer">business.safety.google/adscookies</a>.</p>
      </>,
    },
    {
      id: "rezim-souhlasu", title: "Jak funguje souhlas",
      body: <>
        <ul>
          <li>Dokud se nerozhodnete, běží analytické i marketingové měření v režimu „odmítnuto“ (Google Consent Mode v2) — Google neukládá cookies do vašeho prohlížeče. Značky Google mohou i bez souhlasu odeslat základní signál bez cookies (např. že proběhla návštěva), bez identifikace zařízení.</li>
          <li>Tlačítka „Odmítnout“ a „Přijmout“ jsou rovnocenná; v nastavení můžete povolit jen některé kategorie.</li>
          <li>Volbu si pamatujeme {months} měsíců v cookie <code>cookie_consent</code>. Poté (nebo když změníme kategorie) se vás zeptáme znovu.</li>
          <li>Administrace webu se neměří.</li>
        </ul>
      </>,
    },
    {
      id: "zmena", title: "Jak souhlas změnit nebo odvolat",
      body: <>
        <p>Volbu můžete kdykoli změnit nebo souhlas odvolat:</p>
        <p><CookieSettingsButton label="Otevřít nastavení cookies" className="btn btn-primary" /></p>
        <p>Stejný odkaz „Nastavení cookies“ je v patičce každé stránky. Cookies můžete také smazat nebo zablokovat v nastavení prohlížeče; bez nezbytných ale nebude fungovat košík.</p>
        <p>Jak zpracováváme osobní údaje, popisují <Link href="/ochrana-osobnich-udaju">zásady ochrany osobních údajů</Link>.</p>
      </>,
    },
  ];
  return <LegalPage href="/cookies" title="Zásady cookies" sections={sections} />;
}
