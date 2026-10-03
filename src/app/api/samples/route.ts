import { NextResponse } from "next/server";
import { z } from "zod";
import { calculations, emailQueue, products, sampleRequests, settings } from "@/lib/db/repos";
import { newId, nowIso } from "@/lib/db/store";
import { unsubscribeUrl } from "@/lib/unsubscribe";
import type { EmailQueueItem } from "@/lib/types";

// Pořadí polí = pořadí ve formuláři: první chybné pole vracíme klientovi (`field`), ten mu dá focus.
// Telefon formulář už neposílá (nepovinný) — pole zůstává kvůli zpětné kompatibilitě.
// Zaslání vzorků = plnění smlouvy (žádný povinný souhlas). Navazující e-maily jen s nepovinným souhlasem `marketing`.
const Body = z.object({
  name: z.string().trim().min(2).max(120), email: z.string().trim().email().max(200), phone: z.string().max(30).optional().default(""),
  street: z.string().trim().min(2).max(160), zip: z.string().trim().regex(/^\d{3} ?\d{2}$/), city: z.string().trim().min(2).max(120),
  productIds: z.array(z.string().max(80)).min(1).max(50), calculationId: z.string().max(80).nullable().optional(),
  marketing: z.boolean().optional().default(false),
});

export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Zkontrolujte prosím vyplněné údaje.", field: String(parsed.error.issues[0]?.path[0] ?? "") }, { status: 400 });
  const d = parsed.data;
  const cfg = settings.get();
  const ids = [...new Set(d.productIds)].filter((id) => { const p = products.byId(id); return p && p.status !== "hidden"; }).slice(0, cfg.samples.max);
  if (ids.length < cfg.samples.min) return NextResponse.json({ error: `Vyberte alespoň ${cfg.samples.min} vzorek.`, field: "productIds" }, { status: 400 });
  const calculationId = d.calculationId && calculations.byId(d.calculationId) ? d.calculationId : null;
  const id = newId("s");
  const createdAt = nowIso();
  sampleRequests.add({
    id, createdAt, email: d.email, name: d.name, phone: d.phone ?? "", street: d.street, zip: d.zip, city: d.city,
    productIds: ids, calculationId, consent: d.marketing, marketingConsent: d.marketing, marketingConsentAt: d.marketing ? createdAt : null, status: "new",
  });
  // D+0 potvrzení (transakční) vždy. D+3 připomínka s kalkulací a D+7 sleva jen se souhlasem — a s odkazem na odhlášení.
  // Odesílač je oddělený krok (admin / cron).
  const day = 86400_000;
  const decors = ids.map((x) => { const p = products.byId(x)!; return `${p.brand} ${p.name}`; });
  const q: EmailQueueItem[] = [
    { id: newId("e"), sampleRequestId: id, to: d.email, type: "sample-confirm", dueAt: createdAt, sentAt: null, payload: { decors } },
  ];
  if (d.marketing) {
    const unsubscribe = unsubscribeUrl(d.email);
    q.push(
      { id: newId("e"), sampleRequestId: id, to: d.email, type: "sample-reminder-calc", dueAt: new Date(Date.now() + 3 * day).toISOString(), sentAt: null, payload: { decors, calculationId, unsubscribeUrl: unsubscribe } },
      { id: newId("e"), sampleRequestId: id, to: d.email, type: "sample-discount", dueAt: new Date(Date.now() + 7 * day).toISOString(), sentAt: null, payload: { decors, code: `VZOREK-${id.slice(-4).toUpperCase()}`, discountPct: 5, unsubscribeUrl: unsubscribe } },
    );
  }
  emailQueue.addMany(q);
  return NextResponse.json({ id });
}
