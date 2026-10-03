import { NextResponse } from "next/server";
import { z } from "zod";
import { accessories, products, settings } from "@/lib/db/repos";
import { calculateProject, underlayNeed } from "@/lib/calc";
import { toPublicAccessory, toPublicProduct, toPublicSettings } from "@/lib/public";
import { normalizeItems, type AccessorySuggestion } from "@/lib/orderGuard";
import type { RoomInput } from "@/lib/types";

const Body = z.object({
  items: z.array(z.object({ kind: z.enum(["product", "accessory"]), id: z.string().max(80), qty: z.number().int().min(0).max(999) })).max(200),
});

/**
 * Košík: k podlaze, ke které chybí podložka / soklové lišty, navrhne množství stejně jako kalkulačka
 * (`calculateProject` — podložka ⌈plocha / pokrytí role⌉ jen u podlah, které ji potřebují; sokl ⌈obvod / délka lišty⌉,
 * obvod odhadnutý jako 4 × √plocha). Příslušenství přednostně od stejného dodavatele jako podlaha.
 */
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Neplatný požadavek" }, { status: 400 });
  const items = normalizeItems(parsed.data.items);
  const accs = accessories.visible();
  const kindsInCart = new Set(items.filter((i) => i.kind === "accessory").map((i) => accs.find((a) => a.id === i.id)?.kind).filter(Boolean));
  const pubAccs = accs.map(toPublicAccessory);
  const cfg = toPublicSettings(settings.get());
  const out: AccessorySuggestion[] = [];
  for (const it of items) {
    if (it.kind !== "product") continue;
    const p = products.byId(it.id);
    if (!p || p.status !== "active") continue;
    const wantUnderlay = underlayNeed(p) === "needed" && !kindsInCart.has("underlay");
    const wantSkirting = !kindsInCart.has("skirting");
    if (!wantUnderlay && !wantSkirting) continue;
    const m2 = Math.round(it.qty * p.m2PerPack * 100) / 100;
    const room: RoomInput = { id: "cart", name: "Košík", mode: "area", lengthM: null, widthM: null, areaM2: m2, perimeterM: null, layout: "straight", doors: 0, floorHeating: false };
    const res = calculateProject(toPublicProduct(p), [room], { reservePack: false, includeUnderlay: wantUnderlay, includeSkirting: wantSkirting, includeTransitions: false }, pubAccs, cfg);
    const picked: AccessorySuggestion["items"] = [];
    for (const l of res.lines) {
      if (l.kind !== "accessory" || l.skipped || l.qty <= 0) continue;
      const a = accs.find((x) => x.id === l.refId);
      if (a && (a.kind === "underlay" || a.kind === "skirting")) picked.push({ id: a.id, kind: a.kind, name: a.name, qty: l.qty, unit: a.unit, lineTotal: l.lineTotal });
    }
    if (picked.length) out.push({ productId: p.id, productName: p.name, m2, items: picked, total: picked.reduce((s, x) => s + x.lineTotal, 0) });
  }
  return NextResponse.json({ suggestions: out });
}
