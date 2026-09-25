import type { CalcResult } from "@/lib/types";
import { fmtCzk, fmtNum2 } from "@/lib/format";

export function CalcResultView({ result, compact = false }: { result: CalcResult; compact?: boolean }) {
  return (
    <div>
      {!compact && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <Stat label="Plocha" value={`${fmtNum2(result.totalAreaM2)} m²`} />
          <Stat label="S prořezem" value={`${fmtNum2(result.totalAreaWithWasteM2)} m²`} />
          <Stat label="Balení" value={String(result.packs)} hint={`= ${fmtNum2(result.coveredAreaM2)} m²`} />
          <Stat label="Obvod / dveře" value={`${fmtNum2(result.totalPerimeterM)} m`} hint={`${result.totalDoors} dveří`} />
        </div>
      )}
      <ul className={compact ? "divide-y divide-line" : "mt-6 divide-y divide-line"}>
        {result.lines.map((l, i) => (
          <li key={`${l.refId}-${i}`} className="py-3 flex gap-3 items-start">
            <div className="flex-1 min-w-0">
              <p className={l.skipped ? "text-muted" : ""}>{l.name}</p>
              <p className="text-xs text-muted mt-0.5">{l.detail}</p>
            </div>
            {l.skipped ? <span className="tag tag-sage">nepotřeba</span> : (
              <div className="text-right shrink-0">
                <p className="tabular-nums">{l.qty} {l.unit}</p>
                <p className="text-xs text-muted">{fmtCzk(l.unitPrice)} / {l.unit}</p>
              </div>
            )}
            {!l.skipped && <div className="w-24 text-right tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</div>}
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
  return <div className="rounded-md bg-bg p-3"><p className="eyebrow !text-[0.62rem]">{label}</p><p className="text-lg mt-1 leading-none">{value}</p>{hint && <p className="text-xs text-muted mt-1">{hint}</p>}</div>;
}
