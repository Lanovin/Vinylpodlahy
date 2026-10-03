import type { CalcResult } from "@/lib/types";
import { projectTotal } from "@/lib/calc";
import { fmtCzk, fmtNum2, plural } from "@/lib/format";

/** Rozpis kalkulace: položky, doprava po zásilkách (stejně jako košík, bez vynášky) a celkem. */
export function CalcResultView({ result, compact = false }: { result: CalcResult; compact?: boolean }) {
  const ship = result.shipping;
  const wastePct = new Set(result.rooms.map((r) => r.wastePct));
  const wasteLabel = wastePct.size === 1 ? `+${[...wastePct][0]} % na odřezky` : "+ odřezky";
  return (
    <div>
      {!compact && (<>
        {/* Na telefonu jeden řádek místo čtyř dlaždic */}
        <p className="sm:hidden text-sm text-ink-soft">{fmtNum2(result.totalAreaM2)} m² ({wasteLabel} = {fmtNum2(result.totalAreaWithWasteM2)} m²) · {result.packs} bal. · obvod {fmtNum2(result.totalPerimeterM)} m · dveře: {result.totalDoors}</p>
        <div className="hidden sm:grid grid-cols-4 gap-3 text-sm">
          <Stat label="Plocha" value={`${fmtNum2(result.totalAreaM2)} m²`} />
          <Stat label="Vč. odřezků" value={`${fmtNum2(result.totalAreaWithWasteM2)} m²`} hint={wasteLabel} />
          <Stat label="Balení" value={String(result.packs)} hint={`= ${fmtNum2(result.coveredAreaM2)} m²`} />
          <Stat label="Obvod / dveře" value={`${fmtNum2(result.totalPerimeterM)} m`} hint={`Dveře: ${result.totalDoors}`} />
        </div>
      </>)}
      <ul className={compact ? "divide-y divide-line" : "mt-3 sm:mt-6 divide-y divide-line"}>
        {result.lines.map((l, i) => (
          <li key={`${l.refId}-${i}`} className="py-3 flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p className={l.skipped ? "text-muted" : ""}>{l.name}</p>
              <p className="text-xs text-muted mt-0.5">{l.detail}</p>
              {!l.skipped && <p className="sm:hidden text-xs text-ink-soft mt-0.5 tabular-nums">{l.qty} {l.unit} × {fmtCzk(l.unitPrice)}</p>}
            </div>
            {l.skipped ? <span className="tag tag-sage shrink-0">Není potřeba</span> : (
              <div className="hidden sm:block text-right shrink-0">
                <p className="tabular-nums">{l.qty} {l.unit}</p>
                <p className="text-xs text-muted">{fmtCzk(l.unitPrice)} / {l.unit}</p>
              </div>
            )}
            {!l.skipped && <div className="sm:w-24 text-right tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</div>}
          </li>
        ))}
        {ship && ship.shipments.length > 0 && (
          <li className="py-3 flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p>Doprava{ship.shipments.length > 1 ? ` · ${ship.shipments.length} ${plural(ship.shipments.length, "zásilka", "zásilky", "zásilek")}` : ""}</p>
              <ul className="text-xs text-muted mt-0.5 space-y-0.5">
                {ship.shipments.map((s) => (
                  <li key={s.supplierId}>{s.label}: {s.methodLabel.toLowerCase()} · {s.free ? `zdarma (${fmtNum2(s.floorM2)} m² podlahy)` : fmtCzk(s.price)}</li>
                ))}
              </ul>
              <p className="text-xs text-muted mt-0.5">Ke krajnici / ke dveřím domu. Vynášku do patra přidáte v košíku.</p>
            </div>
            <div className="sm:w-24 text-right tabular-nums shrink-0">{ship.total === 0 ? <span className="text-ok">zdarma</span> : fmtCzk(ship.total)}</div>
          </li>
        )}
      </ul>
      <div className="flex justify-between items-baseline gap-3 pt-4 border-t border-ink mt-1">
        <span className="text-muted text-sm">{ship ? "Celý projekt vč. DPH a dopravy" : "Celkem vč. DPH (bez dopravy)"}</span>
        <span className="text-2xl tabular-nums">{fmtCzk(projectTotal(result))}</span>
      </div>
      {result.warnings.length > 0 && (
        <ul className="mt-4 space-y-2">{result.warnings.map((w) => <li key={w} className="notice notice-warn text-sm">{w}</li>)}</ul>
      )}
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return <div className="rounded-md bg-bg p-3"><p className="eyebrow !text-[0.68rem]">{label}</p><p className="text-lg mt-1 leading-none">{value}</p>{hint && <p className="text-xs text-muted mt-1">{hint}</p>}</div>;
}
