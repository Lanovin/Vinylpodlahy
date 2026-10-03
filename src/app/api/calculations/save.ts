import { z } from "zod";
import { accessories, calculations, products, settings } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { calculateProject } from "@/lib/calc";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";

const ROOM_KINDS = ["living", "bedroom", "kitchen", "bathroom", "hallway", "commercial"] as const;

const Room = z.object({
  id: z.string(), name: z.string().max(80), mode: z.enum(["dims", "area"]),
  lengthM: z.number().min(0).max(500).nullable(), widthM: z.number().min(0).max(500).nullable(), areaM2: z.number().min(0).max(100000).nullable(), perimeterM: z.number().min(0).max(5000).nullable(),
  layout: z.enum(["straight", "diagonal", "herringbone"]), doors: z.number().int().min(0).max(50), floorHeating: z.boolean(),
  kind: z.enum(ROOM_KINDS).nullable().optional(),
});
const Answers = z.object({
  roomKinds: z.array(z.enum(ROOM_KINDS)).max(6),
  budget: z.enum(["lt400", "400-700", "700-1000", "gt1000"]).nullable(),
  style: z.enum(["light-oak", "dark-wood", "grey", "stone"]).nullable(),
  floorHeating: z.boolean(), kidsPets: z.boolean(), integratedUnderlay: z.boolean(), diyClick: z.boolean(),
});

/** Vstup kalkulace z klienta (rozměry + volby). Ceny klient neposílá — přepočítávají se na serveru. */
export const CalcInput = z.object({
  productId: z.string(),
  rooms: z.array(Room).min(1).max(30),
  options: z.object({ reservePack: z.boolean(), includeUnderlay: z.boolean(), includeSkirting: z.boolean(), includeTransitions: z.boolean() }),
  answers: Answers.nullable().optional(),
});
export type CalcInput = z.infer<typeof CalcInput>;

/** Přepočítá kalkulaci na serveru a uloží ji. Vrací null, když produkt neexistuje. */
export function saveCalculation(input: CalcInput) {
  const p = products.byId(input.productId);
  if (!p) return null;
  // Výsledek přepočítáme na serveru — klientovi nevěříme ceny.
  const result = calculateProject(toPublicProduct(p), input.rooms, input.options, accessories.visible().map(toPublicAccessory), toPublicSettings(settings.get()));
  const id = newId("c");
  const calc = { id, createdAt: nowIso(), productId: p.id, rooms: input.rooms, options: input.options, answers: input.answers ?? null, result, productSnapshot: { name: `${p.brand} ${p.name}`, pricePerM2: p.pricePerM2, pricePerPack: p.pricePerPack, m2PerPack: p.m2PerPack } };
  calculations.add(calc);
  return calc;
}
