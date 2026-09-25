import type { Shipment } from "@/lib/types";
import { fmtCzk, fmtKg, fmtNum2 } from "@/lib/format";
import { Truck, Package } from "@/components/ui/icons";

export function ShipmentsView({ shipments, showCarryUp }: { shipments: Shipment[]; showCarryUp: boolean }) {
  return (
    <div className="space-y-3">
      {shipments.map((s, i) => (
        <div key={s.supplierId} className="card p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <span className="h-9 w-9 rounded-full bg-bg grid place-items-center shrink-0">{s.method === "pallet" ? <Truck className="h-5 w-5" /> : <Package className="h-5 w-5" />}</span>
              <div>
                <p className="leading-tight">{shipments.length > 1 && <span className="text-muted">Zásilka {i + 1}/{shipments.length} · </span>}{s.methodLabel}</p>
                <p className="text-xs text-muted mt-0.5">Odesílá {s.supplierName} ({s.shipsFrom}) · {fmtKg(s.weightKg)}{s.weightEstimated ? " (odhad)" : ""} · dodání {s.deliveryLabel}</p>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className={s.freeShipping ? "text-ok" : ""}>{s.freeShipping ? "zdarma" : fmtCzk(s.price)}</p>
              {s.freeShipping && s.basePrice > 0 && <p className="text-xs text-muted line-through">{fmtCzk(s.basePrice)}</p>}
              {showCarryUp && s.carryUpPrice > 0 && <p className="text-xs text-muted">+ vynáška {fmtCzk(s.carryUpPrice)}</p>}
            </div>
          </div>
          <ul className="mt-3 text-xs text-muted space-y-0.5 pl-12">{s.items.map((it) => <li key={`${it.kind}-${it.id}`}>{it.qty}× {it.name}</li>)}</ul>
          <ul className="mt-2 pl-12 text-xs text-ink-soft space-y-0.5">{s.notes.map((n) => <li key={n}>· {n}</li>)}</ul>
          {s.floorM2 > 0 && !s.freeShipping && <p className="mt-2 pl-12 text-xs text-muted">V zásilce je {fmtNum2(s.floorM2)} m² podlahy.</p>}
        </div>
      ))}
    </div>
  );
}
