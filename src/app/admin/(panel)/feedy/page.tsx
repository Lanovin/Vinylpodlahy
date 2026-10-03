import { alerts, feedRuns, suppliers } from "@/lib/db/repos";
import { Card, PageHead, Saved, Status } from "@/components/admin/ui";
import { acknowledgeAlertAction, resetDemoFeedsAction, saveSupplierFeedUrlAction, simulateFeedChangesAction, syncSupplierAction, toggleSupplierAction } from "../../actions";
import { fmtDate } from "@/lib/format";

export default async function Page({ searchParams }: { searchParams: Promise<{ synced?: string; simulated?: string; reset?: string }> }) {
  const sp = await searchParams;
  const sups = suppliers.all();
  const runs = feedRuns.all().slice(0, 30);
  const open = alerts.open();
  return (
    <>
      <PageHead title="Feedy a dodavatelé" text="Import z XML feedů: snapshot + diff, ne přepis naslepo. Skok nákupní ceny nad limit → produkt pozastaven. Produkt zmizel → pozastaven. Feed nedorazil → poslední stav zůstává. Cron: POST /api/feed/sync s hlavičkou x-sync-secret, 2–4× denně.">
        <form action={syncSupplierAction}><input type="hidden" name="supplierId" value="" /><button className="btn btn-primary btn-sm">Synchronizovat vše</button></form>
        <form action={simulateFeedChangesAction}><button className="btn btn-outline btn-sm">Demo: simulovat změny ve feedu</button></form>
        <form action={resetDemoFeedsAction}><button className="btn btn-ghost btn-sm">Demo: obnovit výchozí feedy</button></form>
      </PageHead>
      <Saved show={!!sp.synced} text="Synchronizace proběhla." />
      <Saved show={!!sp.simulated} text="Do feedů byly zapsány změny (skok ceny +15 % u Terrano Dub medový, zmizení Quaro Beton světlý, pokles skladu Nordwood Dub alpský) a proběhl sync. Podívejte se na upozornění níže." />
      <Saved show={!!sp.reset} text="Feedy obnoveny do výchozího stavu a synchronizovány. Produkty pozastavené kvůli zmizení se automaticky vrátily; skok ceny vyžaduje ruční schválení v Produktech." />
      <div className="grid md:grid-cols-3 gap-4">
        {sups.map((s) => (
          <Card key={s.id}>
            <div className="flex items-start justify-between gap-2"><div><h2 className="text-lg">{s.name}</h2><p className="text-xs text-muted">adaptér <code>{s.adapter}</code> · expeduje z {s.shipsFrom}</p></div><Status value={s.active ? "active" : "paused"} /></div>
            <p className="text-sm mt-3">Poslední sync: <Status value={s.lastSyncStatus} /> <span className="text-muted text-xs">{s.lastSyncAt ? fmtDate(s.lastSyncAt) : "—"}</span></p>
            <form action={saveSupplierFeedUrlAction} className="mt-3 flex gap-1"><input type="hidden" name="id" value={s.id} /><input name="feedUrl" className="input !py-1 text-xs" defaultValue={s.feedUrl} /><button className="btn btn-ghost btn-sm !h-8 !px-2 text-xs">Uložit</button></form>
            <div className="flex gap-2 mt-3">
              <form action={syncSupplierAction}><input type="hidden" name="supplierId" value={s.id} /><button className="btn btn-outline btn-sm" disabled={!s.active}>Synchronizovat</button></form>
              <form action={toggleSupplierAction}><input type="hidden" name="id" value={s.id} /><button className="btn btn-ghost btn-sm">{s.active ? "Deaktivovat" : "Aktivovat"}</button></form>
            </div>
          </Card>
        ))}
      </div>
      <div className="grid xl:grid-cols-2 gap-4 mt-6">
        <Card>
          <div className="flex items-center justify-between mb-3"><h2 className="text-lg">Otevřená upozornění ({open.length})</h2>{open.length > 0 && <form action={acknowledgeAlertAction}><input type="hidden" name="id" value="all" /><button className="btn btn-ghost btn-sm">Potvrdit vše</button></form>}</div>
          <ul className="divide-y divide-line text-sm max-h-[520px] overflow-y-auto">{open.map((a) => <li key={a.id} className="py-2 flex gap-3"><span className="text-xs text-muted shrink-0 w-28">{fmtDate(a.createdAt)}</span><span className="flex-1">{a.message}</span><form action={acknowledgeAlertAction}><input type="hidden" name="id" value={a.id} /><button className="text-xs text-muted hover:text-ink">✓</button></form></li>)}{open.length === 0 && <li className="text-muted py-2">Nic otevřeného.</li>}</ul>
        </Card>
        <Card className="!p-0 overflow-x-auto">
          <table className="admin-table"><thead><tr><th>Kdy</th><th>Dodavatel</th><th>Stav</th><th>Ve feedu</th><th>Přidáno</th><th>Změněno</th><th>Beze změny</th><th>Chybí</th><th>Skok ceny</th><th>Fotky</th></tr></thead><tbody>
            {runs.map((r) => <tr key={r.id}><td className="text-xs text-muted whitespace-nowrap">{fmtDate(r.finishedAt)}</td><td className="text-xs">{sups.find((s) => s.id === r.supplierId)?.name}</td><td><Status value={r.status} />{r.error && <p className="text-xs text-danger mt-1 max-w-[200px]">{r.error}</p>}</td><td>{r.stats.inFeed}</td><td>{r.stats.added}</td><td>{r.stats.updated}</td><td>{r.stats.unchanged}</td><td>{r.stats.missing}</td><td>{r.stats.pausedPriceJump}</td><td>{r.stats.imagesProcessed}</td></tr>)}
          </tbody></table>
        </Card>
      </div>
    </>
  );
}
