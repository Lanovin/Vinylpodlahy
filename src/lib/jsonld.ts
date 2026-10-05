import type { SiteContent } from "./types";
import { SITE_NAME, SITE_URL, SOCIAL_PROFILES } from "./site";

/**
 * JSON-LD se skládá ze stejných dat, ze kterých se renderují stránky (admin → Texty webu, produkty z feedu).
 * Hodnoty, které jsou ještě zástupné („[doplňte IČO]“, telefon samé nuly), se do schema nikdy nedostanou.
 */

/** Je hodnota skutečně vyplněná? (ne prázdná, ne „[doplňte …]“, ne „TODO“, ne telefon ze samých nul) */
export function isFilled(v: string | null | undefined): v is string {
  const s = (v ?? "").trim();
  if (!s) return false;
  if (/\[\s*doplňte|\btodo\b/i.test(s)) return false;
  if (/^[+\d\s()-]+$/.test(s) && !/[1-9]/.test(s.replace(/^\+?420/, ""))) return false;
  return true;
}

/** Odstraní `undefined`, prázdné řetězce, prázdná pole a prázdné objekty (rekurzivně). */
export function compact<T>(value: T): T | undefined {
  if (Array.isArray(value)) {
    const arr = value.map((v) => compact(v)).filter((v) => v !== undefined);
    return (arr.length ? arr : undefined) as T | undefined;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value).map(([k, v]) => [k, compact(v)] as const).filter(([, v]) => v !== undefined);
    return (entries.length ? Object.fromEntries(entries) : undefined) as T | undefined;
  }
  if (value === "" || value === null || value === undefined) return undefined;
  return value;
}

export const ldId = (fragment: string) => `${SITE_URL}/#${fragment}`;

/** Firma jako internetový obchod (`OnlineStore` je podtyp `Organization`). Bez kamenné prodejny není `LocalBusiness`. */
export function organizationLd(contact: SiteContent["contact"]) {
  const email = isFilled(contact.email) ? contact.email.trim() : undefined;
  const phone = isFilled(contact.phone) ? contact.phone.trim() : undefined;
  const ico = isFilled(contact.ico) && /\d{6,8}/.test(contact.ico) ? contact.ico.replace(/\s/g, "") : undefined;
  const dic = isFilled(contact.dic) && /^[A-Z]{2}\d+$/i.test(contact.dic.replace(/\s/g, "")) ? contact.dic.replace(/\s/g, "").toUpperCase() : undefined;
  return compact({
    "@context": "https://schema.org",
    "@type": "OnlineStore",
    "@id": ldId("organization"),
    name: SITE_NAME,
    legalName: isFilled(contact.company) ? contact.company.trim() : undefined,
    url: SITE_URL,
    description: "Internetový obchod s vinylovými a SPC podlahami a příslušenstvím. Kalkulačka spočítá balení, podložku, lišty i dopravu na vaše metry.",
    email,
    telephone: phone,
    address: isFilled(contact.address) ? contact.address.trim() : undefined,
    taxID: ico,
    vatID: dic,
    contactPoint: email || phone ? { "@type": "ContactPoint", contactType: "customer service", email, telephone: phone, availableLanguage: "cs" } : undefined,
    sameAs: SOCIAL_PROFILES.filter(isFilled),
  });
}

/** Web a jeho vyhledávání v katalogu (`/podlahy?q=`). */
export function websiteLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": ldId("website"),
    name: SITE_NAME,
    url: SITE_URL,
    inLanguage: "cs-CZ",
    publisher: { "@id": ldId("organization") },
    potentialAction: { "@type": "SearchAction", target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/podlahy?q={search_term_string}` }, "query-input": "required name=search_term_string" },
  };
}
