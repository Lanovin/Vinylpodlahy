import type { CalcResult } from "@/lib/types";
import { fmtCzk, fmtNum2, plural } from "@/lib/format";

export function CalcResultView({ result, compact = false }: { result: CalcResult; compact?: boolean }) {
  return (
    <div>
      {!compact && (<>
        {/* Na telefonu jeden řádek místo čtyř dlaždic */}
        <p className="sm:hidden text-sm text-ink-soft">{fmtNum2(result.totalAreaM2)} m² (s prořezem {fmtNum2(result.totalAreaWithWasteM2)}) · {result.packs} bal. · obvod {fmtNum2(result.totalPerimeterM)} m · {result.totalDoors} {plural(result.totalDoors, "dveře", "dveře", "dveří")}</p>
        <div className="hidden sm:grid grid-cols-4 gap-3 text-sm">
          <Stat label="Plocha" value={`${fmtNum2(result.totalAreaM2)} m²`} />
          <Stat label="S prořezem" value={`${fmtNum2(result.totalAreaWithWasteM2)} m²`} />
          <Stat label="Balení" value={String(result.packs)} hint={`= ${fmtNum2(result.coveredAreaM2)} m²`} />
          <Stat label="Obvod / dveře" value={`${fmtNum2(result.totalPerimeterM)} m`} hint={`${result.totalDoors} dveří`} />
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
            {l.skipped ? <span className="tag tag-sage">nepotřeba</span> : (
              <div className="hidden sm:block text-right shrink-0">
                <p className="tabular-nums">{l.qty} {l.unit}</p>
                <p className="text-xs text-muted">{fmtCzk(l.unitPrice)} / {l.unit}</p>
              </div>
            )}
            {!l.skipped && <div className="sm:w-24 text-right tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</div>}
          </li>
        ))}
      </ul>
      <div className="flex justify-between items-baseline pt-4 border-t border-ink mt-1">
        <span className="text-muted text-sm">Celkem vč. DPH (bez dopravy)</span>
        <span className="text-2xl">{fmtCzk(result.total)}</span>
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
