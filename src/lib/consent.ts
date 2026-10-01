/** Souhlas s cookies — sdílené konstanty pro lištu (klient) i inline skript s Google Consent Mode v2 (viz components/layout/Gtm.tsx). */
export const CONSENT_COOKIE = "cookie_consent";
/** Při změně kategorií zvyš — uložený souhlas se starou verzí se ignoruje a lišta se zobrazí znovu. */
export const CONSENT_VERSION = 1;
export const CONSENT_MAX_AGE = 60 * 60 * 24 * 365;
/** Událost, kterou odkaz „Nastavení cookies“ (např. v patičce) znovu otevře lištu. */
export const CONSENT_OPEN_EVENT = "cookie-consent:open";

export type Consent = { analytics: boolean; marketing: boolean };

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
