/** Souhlas s cookies — sdílené konstanty pro lištu (klient) i inline skript s Google Consent Mode v2 (viz components/layout/Gtm.tsx). */
export const CONSENT_COOKIE = "cookie_consent";
/** Při změně kategorií zvyš — uložený souhlas se starou verzí se ignoruje a lišta se zobrazí znovu. */
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
/** Událost, kterou odkaz „Nastavení cookies“ (např. v patičce) znovu otevře lištu. */
export const CONSENT_OPEN_EVENT = "cookie-consent:open";

export type Consent = { analytics: boolean; marketing: boolean };

/** Úložiště, která web používá — pro lištu i stránku Zásady cookies (/cookies). Při změně kategorií zvyš CONSENT_VERSION. */
export interface CookieInfo { name: string; provider: string; purpose: string; expiry: string; type: "cookie" | "localStorage" | "sessionStorage" }
export interface ConsentCategory { key: keyof Consent | "necessary"; title: string; text: string; legal: string; items: CookieInfo[] }

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  {
    key: "necessary",
    title: "Nezbytné",
    text: "Košík, rozpracovaná kalkulace a zapamatování této volby. Bez nich web nefunguje, proto jsou vždy zapnuté.",
    legal: "Nevyžadují souhlas — jsou nezbytné pro službu, o kterou jste požádali (§ 89 odst. 3 zákona o elektronických komunikacích).",
    items: [
      { name: CONSENT_COOKIE, provider: "vinylpodlahy.cz", purpose: "Zapamatuje si vaši volbu cookies.", expiry: "12 měsíců", type: "cookie" },
      { name: "vinylpodlahy-cart", provider: "vinylpodlahy.cz", purpose: "Obsah košíku a vybrané vzorky.", expiry: "do smazání v prohlížeči", type: "localStorage" },
      { name: "vp-wizard-v2", provider: "vinylpodlahy.cz", purpose: "Rozpracovaná kalkulace, aby přežila obnovení stránky.", expiry: "do zavření karty", type: "sessionStorage" },
      { name: "vp-viz-quality", provider: "vinylpodlahy.cz", purpose: "Zvolená náročnost 3D vizualizace (jen při ruční volbě).", expiry: "do smazání v prohlížeči", type: "localStorage" },
      { name: "vp_admin", provider: "vinylpodlahy.cz", purpose: "Přihlášení do administrace (jen pro provozovatele).", expiry: "12 hodin", type: "cookie" },
    ],
  },
  {
    key: "analytics",
    title: "Analytické",
    text: "Statistiky návštěvnosti v Google Analytics (přes Google Tag Manager): které stránky a nástroje se používají. Google přitom zpracovává identifikátor zařízení a zkrácenou IP adresu.",
    legal: "Jen s vaším souhlasem.",
    items: [
      { name: "_ga, _ga_*", provider: "Google (Google Analytics 4)", purpose: "Rozlišení návštěvníků a relací pro statistiky.", expiry: "až 2 roky", type: "cookie" },
    ],
  },
  {
    key: "marketing",
    title: "Marketingové",
    text: "Měření reklam a remarketing (Google Ads): abychom věděli, která reklama přivedla návštěvu nebo objednávku, a mohli vám jinde na webu ukázat související nabídku.",
    legal: "Jen s vaším souhlasem.",
    items: [
      { name: "_gcl_au, _gcl_aw", provider: "Google (Google Ads)", purpose: "Přiřazení objednávky ke kliknutí na reklamu.", expiry: "90 dní", type: "cookie" },
      { name: "IDE, test_cookie", provider: "Google (doubleclick.net)", purpose: "Remarketing a měření zobrazení reklam.", expiry: "až 13 měsíců", type: "cookie" },
    ],
  },
];

type Stored = { v: number; a: boolean; m: boolean };

type ConsentValue = "granted" | "denied";
export type ConsentModeState = Record<
  "ad_storage" | "ad_user_data" | "ad_personalization" | "analytics_storage" | "functionality_storage" | "personalization_storage" | "security_storage",
  ConsentValue
>;

const g = (on: boolean): ConsentValue => (on ? "granted" : "denied");

/** Mapování kategorií na signály Consent Mode v2. Nezbytné (funkční, bezpečnostní) jsou povoleny vždy. */
export function toConsentMode(c: Consent): ConsentModeState {
  return {
    ad_storage: g(c.marketing),
    ad_user_data: g(c.marketing),
    ad_personalization: g(c.marketing),
    analytics_storage: g(c.analytics),
    functionality_storage: "granted",
    personalization_storage: g(c.marketing),
    security_storage: "granted",
  };
}

export function readConsent(): Consent | null {
  try {
    const m = document.cookie.match(new RegExp(`(?:^|; )${CONSENT_COOKIE}=([^;]*)`));
    if (!m) return null;
    const s = JSON.parse(decodeURIComponent(m[1])) as Stored;
    if (s?.v !== CONSENT_VERSION) return null;
    return { analytics: !!s.a, marketing: !!s.m };
  } catch {
    return null;
  }
}

/** Uloží volbu do cookie a oznámí ji Google Tag Manageru (Consent Mode update + událost pro vlastní triggery). */
export function saveConsent(c: Consent): void {
  const stored: Stored = { v: CONSENT_VERSION, a: c.analytics, m: c.marketing };
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${CONSENT_COOKIE}=${encodeURIComponent(JSON.stringify(stored))}; Max-Age=${CONSENT_MAX_AGE}; Path=/; SameSite=Lax${secure}`;
  window.gtag?.("consent", "update", toConsentMode(c));
  window.dataLayer?.push({ event: "cookie_consent_update", consent_analytics: c.analytics, consent_marketing: c.marketing });
}

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}
