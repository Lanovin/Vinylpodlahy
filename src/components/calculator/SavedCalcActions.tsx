"use client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import type { CalcResult, CartItem } from "@/lib/types";
import { useCart } from "@/store/cart";
import { projectTotal, shippingNote } from "@/lib/calc";
import { fmtCzk } from "@/lib/format";
import { Check, Share } from "@/components/ui/icons";

export function SavedCalcActions({ calcId, result, disabled }: { calcId: string; result: CalcResult; disabled: boolean }) {
  const addMany = useCart((s) => s.addMany);
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const toCart = () => { const items: CartItem[] = result.lines.filter((l) => !l.skipped && l.qty > 0).map((l) => ({ kind: l.kind, id: l.refId, qty: l.qty })); addMany(items, calcId); router.push("/kosik"); };
  // Na telefonu nativní sdílení (WhatsApp, e-mail…), jinak zkopírovat odkaz.
  const share = async () => {
    const url = window.location.href;
    if (navigator.share) { try { await navigator.share({ title: "Kalkulace podlahy", url }); } catch { /* zrušeno */ } return; }
    await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500);
  };
  return (
    <>
      <div className="grid gap-2">
        <button type="button" className="btn btn-accent btn-lg w-full" disabled={disabled} onClick={toCart}>Vložit celý projekt do košíku</button>
        <button type="button" className="btn btn-outline w-full" onClick={share}>{copied ? <Check className="h-4 w-4" /> : <Share className="h-4 w-4" />} {copied ? "Odkaz zkopírován" : "Sdílet kalkulaci"}</button>
      </div>
      <SendCalcEmail className="mt-4" ensureId={async () => calcId} />
      {!disabled && (
        <div className="lg:hidden fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="container py-2 flex items-center gap-2">
            <div className="flex-1 min-w-0 leading-tight"><p className="text-lg tabular-nums">{fmtCzk(projectTotal(result))}</p><p className="text-xs text-muted truncate">celý projekt · {shippingNote(result)}</p></div>
            <button type="button" className="btn btn-accent shrink-0" onClick={toCart}>Do košíku</button>
          </div>
        </div>
      )}
    </>
  );
}

/**
 * „Poslat na e-mail“: jedno pole + tlačítko. `ensureId` vrátí id uložené kalkulace (v průvodci ji teprve uloží).
 * E-mail jde zatím do fronty (data/email-queue.json) — reálné odesílání napojí admin / cron.
 */
export function SendCalcEmail({ ensureId, className }: { ensureId: () => Promise<string | null>; className?: string }) {
  const inputId = useId();
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "error">("idle");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const to = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) { setState("error"); setError("Zkontrolujte prosím e-mailovou adresu."); return; }
    setState("sending"); setError(null);
    const id = await ensureId();
    if (!id) { setState("error"); setError("Kalkulaci se nepodařilo uložit. Zkuste to prosím znovu."); return; }
    const res = await fetch("/api/calculations/email", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: to, calculationId: id }) }).catch(() => null);
    if (!res?.ok) {
      const msg = res ? ((await res.json().catch(() => null)) as { error?: string } | null)?.error : null;
      setState("error"); setError(msg ?? "Odeslání se nepovedlo. Zkuste to prosím znovu."); return;
    }
    setState("idle"); setSentTo(to);
  }

  if (sentTo) {
    return (
      <p className={`notice notice-info text-sm ${className ?? ""}`} role="status">
        <Check className="inline h-4 w-4 mr-1 -mt-0.5" />Odesláno na {sentTo}.{" "}
        <button type="button" className="link" onClick={() => { setSentTo(null); setEmail(""); }}>Poslat jinam</button>
      </p>
    );
  }
  return (
    <form className={className} onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="label">Poslat kalkulaci na e-mail</label>
      <div className="flex gap-2">
        <input id={inputId} type="email" inputMode="email" autoComplete="email" enterKeyHint="send" className="input min-w-0" placeholder="vas@email.cz" value={email}
          aria-invalid={state === "error" && !!error && error.includes("e-mail") ? true : undefined}
          onChange={(e) => { setEmail(e.target.value); if (state === "error") { setState("idle"); setError(null); } }} />
        <button type="submit" className="btn btn-outline shrink-0" disabled={state === "sending"}>{state === "sending" ? "Odesílám…" : "Poslat"}</button>
      </div>
      {error && <p className="text-sm text-danger mt-1.5" role="alert">{error}</p>}
    </form>
  );
}
