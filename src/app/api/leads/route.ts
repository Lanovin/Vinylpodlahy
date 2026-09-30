import { NextResponse } from "next/server";
import { z } from "zod";
import { leads } from "@/lib/db/repos";
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
  name: z.string().trim().min(2).max(120), phone: z.string().trim().min(6).max(30), email: z.string().trim().email(), note: z.string().max(2000).optional().default(""),
  productId: z.string().nullable(), calculationId: z.string().nullable(), source: z.enum(["product", "cart", "page"]),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field: String(parsed.error.issues[0]?.path[0] ?? "") }, { status: 400 });
  const id = newId("l");
  leads.add({ id, createdAt: nowIso(), ...parsed.data, note: parsed.data.note ?? "", orderId: null, status: "new" });
  return NextResponse.json({ id });
}
