import type { SiteContent } from "@/lib/types";

/** Vzorový formulář pro odstoupení od smlouvy (příloha k nařízení vlády č. 363/2013 Sb.) — text pro stránku, tisk i stažení. */
export function withdrawalForm(c: SiteContent["contact"]) {
  return {
    title: "Oznámení o odstoupení od smlouvy",
    note: "(vyplňte tento formulář a pošlete jej zpět pouze v případě, že chcete odstoupit od smlouvy)",
    addressee: `Adresát: ${c.company}, ${c.address}, IČO ${c.ico}, e-mail ${c.email}`,
    lines: [
      "Oznamuji/oznamujeme (*), že tímto odstupuji/odstupujeme (*) od smlouvy o nákupu tohoto zboží:",
      "Číslo objednávky:",
      "Datum objednání (*) / datum obdržení (*):",
      "Jméno a příjmení spotřebitele/spotřebitelů:",
      "Adresa spotřebitele/spotřebitelů:",
      "E-mail a telefon:",
      "Číslo účtu pro vrácení peněz (nepovinné):",
      "Podpis spotřebitele/spotřebitelů (pouze pokud je formulář zasílán v listinné podobě):",
      "Datum:",
    ],
    footnote: "(*) Nehodící se škrtněte nebo údaje doplňte.",
  };
}
