import { content as contentRepo, products, settings as settingsRepo } from "@/lib/db/repos";
import { LANDINGS } from "@/lib/catalog";
import { LEGAL_PAGES } from "@/components/legal/pages";
import { isFilled } from "@/lib/jsonld";
import { absUrl, SITE_NAME, SITE_URL } from "@/lib/site";
import { FLOOR_TYPE_LABEL, type FloorType } from "@/lib/types";
import { fmtInt, plural } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * /llms.txt — stručný přehled webu pro jazykové modely (formát llms.txt: nadpis, citát, odkazy).
 * Sestavuje se z textů v administraci, nastavení dopravy a aktuálních produktů; nic se nepíše ručně.
 * Pozn.: vliv llms.txt na AI vyhledávače zatím není prokázaný.
 */
export function GET() {
  const c = contentRepo.get();
  const cfg = settingsRepo.get();
  const visible = products.visible();
  const link = (title: string, path: string, note?: string) => `- [${title}](${absUrl(path)})${note ? `: ${note}` : ""}`;

  const byType = new Map<FloorType, number[]>();
  for (const p of visible) byType.set(p.type, [...(byType.get(p.type) ?? []), p.pricePerM2]);
  const types = [...byType.entries()].map(([t, prices]) => {
    const lo = Math.min(...prices), hi = Math.max(...prices);
    return `- ${FLOOR_TYPE_LABEL[t]}: ${prices.length} ${plural(prices.length, "dekor", "dekory", "dekorů")}, ${lo === hi ? fmtInt(lo) : `${fmtInt(lo)}–${fmtInt(hi)}`} Kč/m² vč. DPH`;
  });

  const contact = [
    isFilled(c.contact.email) && `- E-mail: ${c.contact.email.trim()}`,
    isFilled(c.contact.phone) && `- Telefon: ${c.contact.phone.trim()}`,
    isFilled(c.contact.hours) && `- Provozní doba: ${c.contact.hours.trim()}`,
  ].filter(Boolean);

  const lines = [
    `# ${SITE_NAME}`,
    "",
    `> ${c.homeIntro.text}`,
    "",
    `Ceny jsou uvedeny včetně DPH ${Math.round(cfg.vatRate * 100)} % za m² i za balení. Zboží posílají dodavatelé přímo ze svých skladů; dostupnost v m² a termín dodání jsou u každého produktu. Doprava zdarma od ${String(cfg.freeShippingFromM2).replace(".", ",")} m².`,
    "",
    "## Hlavní stránky",
    link("Katalog podlah", "/podlahy", "všechny vinylové a SPC podlahy s filtry (typ, tloušťka, nášlap, třída zátěže, cena, dostupnost)"),
    link("Kalkulačka projektu", "/kalkulacka", "spočítá balení s prořezem, podložku, lišty, lepidlo i dopravu na zadané metry"),
    link("Byt ve 3D", "/vizualizace", "vizualizace podlahy v modelovém bytě 2+kk"),
    link("Příslušenství", "/prislusenstvi", "podložky, lišty, lepidla, tmely"),
    link("Doprava a platba", "/doprava", "ceník dopravy podle hmotnosti"),
    link("Pokládka", "/montaz", "poptávka pokládky podlaháře"),
    link("Kontakt", "/kontakt"),
    "",
    "## Kategorie podlah",
    ...LANDINGS.map((l) => link(c.landings[l.slug]?.h1 ?? l.navLabel, `/${l.slug}`, c.landings[l.slug]?.intro)),
    ...(types.length ? ["", "## Nabídka podle typu", ...types] : []),
    ...(contact.length ? ["", "## Kontakt", ...(contact as string[])] : []),
    "",
    "## Obchodní a právní informace",
    ...LEGAL_PAGES.map((l) => link(l.label, l.href)),
    "",
    `Mapa webu: ${SITE_URL}/sitemap.xml`,
    "",
  ];
  return new Response(lines.join("\n"), { headers: { "content-type": "text/plain; charset=utf-8" } });
}
