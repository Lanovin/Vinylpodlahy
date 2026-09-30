"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import clsx from "clsx";

/** Termín jako pevné volby — ukládá se stejný text jako dřív volné pole. */
const TERMS = ["Co nejdřív", "Do měsíce", "Do 3 měsíců", "Zatím nevím"];

type Field = "zip" | "areaM2" | "term" | "name" | "phone" | "email" | "note";
/** Id prvku a hláška k poli, které API vrátí jako první chybné (`field`). */
const FIELDS: Record<Field, [string, string]> = {
  zip: ["i-zip", "Zkontrolujte PSČ (5 číslic)."],
  areaM2: ["i-area", "Zadejte plochu v m² (např. 24,5)."],
  term: ["i-term-0", "Vyberte termín."],
  name: ["i-name", "Vyplňte jméno."],
  phone: ["i-phone", "Zkontrolujte telefon (aspoň 9 číslic)."],
  email: ["i-email", "Zkontrolujte e-mail."],
  note: ["i-note", "Poznámka je moc dlouhá (max. 2 000 znaků)."],
};

export function InstallForm({ productId, calculationId, area, productName, source }: { productId: string | null; calculationId: string | null; area: number | null; productName: string | null; source: "product" | "cart" | "page" }) {
  const router = useRouter();
  const [form, setForm] = useState({ zip: "", areaM2: area ? String(area).replace(".", ",") : "", term: "", name: "", phone: "", email: "", note: "" });
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: Field, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (bad === k) { setBad(null); setErr(null); }
  };
  const fail = (f: Field) => {
    flushSync(() => { setBad(f); setErr(FIELDS[f][1]); });
    document.getElementById(FIELDS[f][0])?.focus();
  };
  const inv = (f: Field) => (bad === f ? { "aria-invalid": true, "aria-describedby": "i-err" } : {});

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBad(null);
    if (!form.term) return fail("term");
    setBusy(true);
    // Plochu posíláme jako text — server z ní vezme číslo (i z „cca 20“).
    const res = await fetch("/api/leads", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, productId, calculationId, source }) });
    setBusy(false);
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (d.field && d.field in FIELDS) return fail(d.field as Field);
      return setErr(d.error ?? "Odeslání se nepodařilo.");
    }
    router.push("/montaz?ok=1");
  }

  return (
    <form onSubmit={submit} className="panel space-y-4">
      {productName && <p className="text-sm text-muted">Podlaha: <strong className="text-ink">{productName}</strong></p>}
      <div className="grid grid-cols-2 gap-4">
        <div><label className="label" htmlFor="i-zip">PSČ pokládky</label><input id="i-zip" className="input" required inputMode="numeric" pattern="[0-9]{3} ?[0-9]{2}" maxLength={6} title="PSČ ve tvaru 110 00" autoComplete="postal-code" enterKeyHint="next" value={form.zip} onChange={(e) => set("zip", e.target.value)} {...inv("zip")} /></div>
        <div>
          <label className="label" htmlFor="i-area">Plocha (m²)</label><input id="i-area" className="input" required inputMode="decimal" pattern="[0-9]+([,.][0-9]+)?" title="Plocha v m², např. 24,5" enterKeyHint="next" value={form.areaM2} onChange={(e) => set("areaM2", e.target.value)} {...inv("areaM2")} />
          <Link href="/kalkulacka" className="inline-flex items-center min-h-10 text-sm link">Nevím → spočítat v kalkulačce</Link>
        </div>
      </div>
      <fieldset>
        <legend className="label">Termín</legend>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {TERMS.map((t, i) => (
            <label key={t} className={clsx("relative h-11 px-2 grid place-items-center text-center text-sm leading-tight rounded-sm border cursor-pointer transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ink/30", form.term === t ? "border-ink bg-ink text-white" : bad === "term" ? "border-danger bg-white" : "border-line-strong bg-white hover:border-ink")}>
              <input id={`i-term-${i}`} type="radio" name="term" value={t} className="sr-only" checked={form.term === t} onChange={() => set("term", t)} {...(i === 0 ? inv("term") : {})} />
              {t}
            </label>
          ))}
        </div>
      </fieldset>
      <div><label className="label" htmlFor="i-name">Jméno</label><input id="i-name" className="input" required minLength={2} autoComplete="name" autoCapitalize="words" enterKeyHint="next" value={form.name} onChange={(e) => set("name", e.target.value)} {...inv("name")} /></div>
      <div className="grid sm:grid-cols-2 gap-4">
        <div><label className="label" htmlFor="i-phone">Telefon</label><input id="i-phone" type="tel" className="input" required minLength={9} autoComplete="tel" enterKeyHint="next" value={form.phone} onChange={(e) => set("phone", e.target.value)} {...inv("phone")} /></div>
        <div><label className="label" htmlFor="i-email">E-mail</label><input id="i-email" type="email" className="input" required autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="done" value={form.email} onChange={(e) => set("email", e.target.value)} {...inv("email")} /></div>
      </div>
      <div><label className="label" htmlFor="i-note">Poznámka (nepovinné)</label><textarea id="i-note" className="textarea" rows={2} maxLength={2000} placeholder="stav podkladu, patro, demontáž staré podlahy…" value={form.note} onChange={(e) => set("note", e.target.value)} {...inv("note")} /></div>
      {err && <p id="i-err" className="notice notice-danger text-sm" role="alert">{err}</p>}
      <button className="btn btn-accent btn-lg w-full" disabled={busy}>{busy ? "Odesílám…" : "Poptat pokládku"}</button>
      <p className="text-xs text-muted">Nezávazné.</p>
    </form>
  );
}
