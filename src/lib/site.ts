/** Veřejná adresa webu: jediné místo pro metadataBase, sitemap, robots, canonical a JSON-LD. Kanonická doména je s `www`. */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.vinylpodlahy.cz").replace(/\/+$/, "");
export const SITE_NAME = "vinylpodlahy.cz";

/** Absolutní URL z cesty ("/podlahy") nebo z již absolutní adresy. */
export function absUrl(path: string) {
  return /^https?:\/\//i.test(path) ? path : `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Profily firmy (Facebook, Instagram, Google Business, Heureka…) pro `sameAs` v JSON-LD. TODO: doplnit, až budou. */
export const SOCIAL_PROFILES: string[] = [];
