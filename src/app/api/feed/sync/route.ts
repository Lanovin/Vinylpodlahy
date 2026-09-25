import { NextResponse } from "next/server";
import { syncAll, syncSupplier } from "@/lib/feed/sync";

/**
 * Spouštěč synchronizace pro cron (2–4× denně), např.:
 *   curl -X POST -H "x-sync-secret: $FEED_SYNC_SECRET" https://vinylpodlahy.cz/api/feed/sync
 * Volitelně ?supplier=vinylia pro jednoho dodavatele.
 */
export const maxDuration = 300;

export async function POST(req: Request) {
  const secret = process.env.FEED_SYNC_SECRET ?? "dev-sync-secret";
  if (req.headers.get("x-sync-secret") !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const supplier = new URL(req.url).searchParams.get("supplier");
  const out = supplier ? [await syncSupplier(supplier)] : await syncAll();
  return NextResponse.json(out.map((o) => ({ supplier: o.run.supplierId, status: o.run.status, stats: o.run.stats, error: o.run.error, alerts: o.alerts.length })));
}
