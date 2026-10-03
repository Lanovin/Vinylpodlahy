/** Právní stránky — patička, sitemap, navigace mezi dokumenty. */
export const LEGAL_PAGES = [
  { href: "/obchodni-podminky", label: "Obchodní podmínky" },
  { href: "/reklamacni-rad", label: "Reklamační řád" },
  { href: "/odstoupeni-od-smlouvy", label: "Odstoupení od smlouvy" },
  { href: "/ochrana-osobnich-udaju", label: "Ochrana osobních údajů" },
  { href: "/cookies", label: "Zásady cookies" },
] as const;

/** Datum účinnosti právních dokumentů. Při každé změně textu aktualizujte (a starou verzi archivujte). */
export const LEGAL_EFFECTIVE_DATE = "1. 11. 2026";
