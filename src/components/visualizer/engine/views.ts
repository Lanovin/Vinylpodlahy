/** Pohledy modelového bytu — bez závislosti na three.js, aby se daly použít v UI i na serveru. */
export type ViewId = "living" | "kitchen" | "bedroom" | "bathroom" | "hallway" | "overview";

export const VIEW_OPTIONS: { id: ViewId; label: string; slug: string }[] = [
  { id: "living", label: "Obývák", slug: "obyvak" },
  { id: "kitchen", label: "Kuchyň", slug: "kuchyn" },
  { id: "bedroom", label: "Ložnice", slug: "loznice" },
  { id: "bathroom", label: "Koupelna", slug: "koupelna" },
  { id: "hallway", label: "Předsíň", slug: "predsin" },
  { id: "overview", label: "Celý byt", slug: "cely-byt" },
];

export const viewFromSlug = (s: string | undefined | null): ViewId | null => VIEW_OPTIONS.find((v) => v.slug === s || v.id === s)?.id ?? null;
export const viewSlug = (v: ViewId) => VIEW_OPTIONS.find((o) => o.id === v)?.slug ?? v;
