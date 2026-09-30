import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, calculations, products, settings } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { calculateProject } from "@/lib/calc";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";

const Room = z.object({
  id: z.string(), name: z.string().max(80), mode: z.enum(["dims", "area"]),
  lengthM: z.number().min(0).max(500).nullable(), widthM: z.number().min(0).max(500).nullable(), areaM2: z.number().min(0).max(100000).nullable(), perimeterM: z.number().min(0).max(5000).nullable(),
  layout: z.enum(["straight", "diagonal", "herringbone"]), doors: z.number().int().min(0).max(50), floorHeating: z.boolean(),
  kind: z.enum(["living", "bedroom", "kitchen", "bathroom", "hallway", "commercial"]).nullable().optional(),
});
const Answers = z.object({
  roomKinds: z.array(z.enum(["living", "bedroom", "kitchen", "bathroom", "hallway", "commercial"])).max(6),
  budget: z.enum(["lt400", "400-700", "700-1000", "gt1000"]).nullable(),
  style: z.enum(["light-oak", "dark-wood", "grey", "stone"]).nullable(),
  floorHeating: z.boolean(), kidsPets: z.boolean(), integratedUnderlay: z.boolean(), diyClick: z.boolean(),
});
const Body = z.object({
  productId: z.string(),
  rooms: z.array(Room).min(1).max(30),
  options: z.object({ reservePack: z.boolean(), includeUnderlay: z.boolean(), includeSkirting: z.boolean(), includeTransitions: z.boolean() }),
  answers: Answers.nullable().optional(),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatná data kalkulace" }, { status: 400 });
  const p = products.byId(parsed.data.productId);
  if (!p) return NextResponse.json({ error: "Produkt nenalezen" }, { status: 404 });
  // Výsledek přepočítáme na serveru — klientovi nevěříme ceny.
  const result = calculateProject(toPublicProduct(p), parsed.data.rooms, parsed.data.options, accessories.visible().map(toPublicAccessory), toPublicSettings(settings.get()));
  const id = newId("c");
  calculations.add({ id, createdAt: nowIso(), productId: p.id, rooms: parsed.data.rooms, options: parsed.data.options, answers: parsed.data.answers ?? null, result, productSnapshot: { name: `${p.brand} ${p.name}`, pricePerM2: p.pricePerM2, pricePerPack: p.pricePerPack, m2PerPack: p.m2PerPack } });
  return NextResponse.json({ id, url: `/kalkulace/${id}` });
}
