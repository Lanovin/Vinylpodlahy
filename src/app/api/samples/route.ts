import { NextResponse } from "next/server";
import { z } from "zod";
import { emailQueue, products, sampleRequests, settings } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import type { EmailQueueItem } from "@/lib/types";

// Pořadí polí = pořadí ve formuláři: první chybné pole vracíme klientovi (`field`), ten mu dá focus.
// Telefon formulář už neposílá (nepovinný) — pole zůstává kvůli zpětné kompatibilitě.
const Body = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email(), phone: z.string().max(30).optional().default(""),
  street: z.string().trim().min(2).max(160), zip: z.string().trim().regex(/^\d{3} ?\d{2}$/), city: z.string().trim().min(2).max(120),
  productIds: z.array(z.string()).min(1), calculationId: z.string().nullable().optional(), consent: z.literal(true),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field: String(parsed.error.issues[0]?.path[0] ?? "") }, { status: 400 });
  const cfg = settings.get();
  const ids = [...new Set(parsed.data.productIds)].filter((id) => products.byId(id)).slice(0, cfg.samples.max);
  if (ids.length < cfg.samples.min) return NextResponse.json({ error: `Vyberte alespoň ${cfg.samples.min} vzorek.` }, { status: 400 });
  const id = newId("s");
  const createdAt = nowIso();
  sampleRequests.add({ id, createdAt, ...parsed.data, phone: parsed.data.phone ?? "", productIds: ids, calculationId: parsed.data.calculationId ?? null, status: "new" });
  // Navazující e-maily: D+0 potvrzení, D+3 připomínka s kalkulací, D+7 sleva. Odesílač je oddělený krok (admin / cron).
  const day = 86400_000;
  const decors = ids.map((x) => { const p = products.byId(x)!; return `${p.brand} ${p.name}`; });
  const q: EmailQueueItem[] = [
    { id: newId("e"), sampleRequestId: id, to: parsed.data.email, type: "sample-confirm", dueAt: createdAt, sentAt: null, payload: { decors } },
    { id: newId("e"), sampleRequestId: id, to: parsed.data.email, type: "sample-reminder-calc", dueAt: new Date(Date.now() + 3 * day).toISOString(), sentAt: null, payload: { decors, calculationId: parsed.data.calculationId ?? null } },
    { id: newId("e"), sampleRequestId: id, to: parsed.data.email, type: "sample-discount", dueAt: new Date(Date.now() + 7 * day).toISOString(), sentAt: null, payload: { decors, code: `VZOREK-${id.slice(-4).toUpperCase()}`, discountPct: 5 } },
  ];
  emailQueue.addMany(q);
  return NextResponse.json({ id });
}
