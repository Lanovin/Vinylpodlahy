"use client";
import Link from "next/link";
import { useCart } from "@/store/cart";
import type { CartQuoteLine } from "@/lib/types";
import { Alert, Trash } from "@/components/ui/icons";

/** Akce u položky, kterou nejde objednat (pozastavená / skrytá): odebrat, nebo najít náhradu. */
export function BlockedActions({ line, className = "" }: { line: CartQuoteLine; className?: string }) {
  const remove = useCart((s) => s.remove);
  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      <button type="button" className="btn btn-primary btn-sm" onClick={() => remove(line.kind, line.id)}><Trash className="h-4 w-4" /> Odebrat</button>
      {line.alternativesHref && <Link href={line.alternativesHref} className="btn btn-outline btn-sm">{line.kind === "product" ? "Podobné dekory" : "Jiné příslušenství"}</Link>}
    </div>
  );
}

/** Souhrnné upozornění nad tlačítkem objednávky: dokud v košíku zůstává nedostupná položka, objednat nejde. */
export function BlockedNotice({ lines }: { lines: CartQuoteLine[] }) {
  const blocked = lines.filter((l) => l.blocked);
  if (blocked.length === 0) return null;
  return (
    <div className="notice notice-danger" role="alert">
      <p className="flex items-start gap-2"><Alert className="h-4 w-4 mt-0.5 shrink-0" /><span><strong>{blocked.length === 1 ? "Jednu položku" : `${blocked.length} položky`} teď nejde objednat.</strong> Odeberte {blocked.length === 1 ? "ji" : "je"}, pak můžete pokračovat.</span></p>
      <ul className="mt-3 space-y-3">
        {blocked.map((l) => (
          <li key={`${l.kind}-${l.id}`}>
            <p className="text-sm text-ink">{l.name}</p>
            <BlockedActions line={l} className="mt-1.5" />
          </li>
        ))}
      </ul>
    </div>
  );
}
