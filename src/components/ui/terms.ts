import type { FloorType, LockType, UsageClass } from "@/lib/types";

/** Krátká vysvětlení odborných pojmů (komponenta <Term>). Jedna dvě věty, laicky. */
export const TERMS = {
  wear: { title: "Nášlapná vrstva", text: "Průhledná ochranná vrstva nahoře. 0,3 mm běžný byt, 0,4 mm rušnější domácnost, 0,55 mm děti, zvířata, komerce." },
  usage: { title: "Třída zátěže", text: "Jaký provoz podlaha vydrží. 23 = do bytu, lehký provoz · 31–32 = do bytu · 33 = byt i komerce · 42 = komerční." },
  spc: { title: "SPC", text: "Jádro z kamenné moučky a PVC. Tvrdé, rozměrově stabilní a 100% voděodolné — i do koupelny a na podlahové topení." },
  hdf: { title: "Vinyl na HDF", text: "Vinylová vrstva na dřevovláknité desce. Teplý a tichý na chůzi, ale jen do suchých místností — voda desku nafoukne." },
  composite: { title: "Vinyl na kompozitu", text: "Pružné voděodolné jádro z PVC a plniv. Měkčí a tišší než SPC, i do koupelny." },
  glue: { title: "Lepený vinyl", text: "Tenké dílce lepené celoplošně k podkladu. Nejnižší výška a voděodolnost, ale potřebuje rovný podklad." },
  selfAdhesive: { title: "Samolepicí vinyl", text: "Dílce s lepidlem na rubu — sundáte fólii a přitisknete. Na menší a rovné plochy." },
  click: { title: "Click zámek", text: "Dílce se zaklapnou do sebe bez lepení (plovoucí podlaha). Zvládnete svépomocí a jde rozebrat." },
  ixpe: { title: "Integrovaná podložka (IXPE)", text: "Tenká pěnová podložka nalepená zespodu lamel. Tlumí kroky — podložku zvlášť nekupujete." },
  bevel: { title: "Fáze (V-drážka)", text: "Zkosené hrany lamel — spoje jsou vidět jako u prkenné podlahy. Bez fáze je plocha hladká." },
  heating: { title: "Na podlahové topení", text: "Výrobce podlahu na podlahové topení schvaluje (teplota povrchu do 27 °C). Kalkulačka přidá podložku vhodnou pod topení." },
  waterproof: { title: "Voděodolná", text: "Jádro vodu nenasaje — hodí se i do koupelny, kuchyně a předsíně." },
} as const;

export type TermId = keyof typeof TERMS;

export const TYPE_TERM: Record<FloorType, TermId> = { spc: "spc", "vinyl-hdf": "hdf", "vinyl-composite": "composite", "vinyl-glue": "glue" };
export const LOCK_TERM: Record<LockType, TermId> = { click: "click", glue: "glue", "self-adhesive": "selfAdhesive" };

/** Třída zátěže lidsky (karty v katalogu, karta produktu, filtry). */
export const USAGE_SHORT: Record<UsageClass, string> = {
  23: "do bytu, lehký provoz",
  31: "do bytu",
  32: "do bytu",
  33: "byt i komerce",
  42: "komerční",
};
