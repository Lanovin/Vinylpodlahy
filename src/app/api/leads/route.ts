import { NextResponse } from "next/server";
import { z } from "zod";
import { calculations, leads, products } from "@/lib/db/repos";
import { phoneOk } from "@/lib/orderGuard";
import { newId, nowIso } from "@/lib/db/store";

/** Plocha: číslo, nebo text s číslem („24,5“, „cca 20 m²“) — bereme první číslo v textu. */
function toArea(v: unknown) {
  if (typeof v !== "string") return v;
  const m = v.match(/\d+(?:[.,]\d+)?/);
  return m ? parseFloat(m[0].replace(",", ".")) : NaN;
}

// Pořadí polí = pořadí ve formuláři: první chybné pole vracíme klientovi (`field`), ten mu dá focus.
const Body = z.object({
  zip: z.string().trim().regex(/^\d{3} ?\d{2}$/), areaM2: z.preprocess(toArea, z.number().min(1).max(100000)), term: z.string().min(2).max(120),
  name: z.string().trim().min(2).max(120), phone: z.string().trim().max(30).refine(phoneOk), email: z.string().trim().email().max(200), note: z.string().max(2000).optional().default(""),
  productId: z.string().max(80).nullable(), calculationId: z.string().max(80).nullable(), source: z.enum(["product", "cart", "page"]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field: String(parsed.error.issues[0]?.path[0] ?? "") }, { status: 400 });
  const id = newId("l");
  // Neexistující vazby (podvržené / smazané id) neukládáme.
  const productId = parsed.data.productId && products.byId(parsed.data.productId) ? parsed.data.productId : null;
  const calculationId = parsed.data.calculationId && calculations.byId(parsed.data.calculationId) ? parsed.data.calculationId : null;
  leads.add({ id, createdAt: nowIso(), ...parsed.data, productId, calculationId, note: parsed.data.note ?? "", orderId: null, status: "new" });
  return NextResponse.json({ id });
}
