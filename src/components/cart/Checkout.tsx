"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { flushSync } from "react-dom";
import { useCart } from "@/store/cart";
import { useQuote } from "./useQuote";
import { ShipmentsView, carryUpText } from "./ShipmentsView";
import { BlockedNotice } from "./BlockedLines";
import { fmtCzk } from "@/lib/format";
import { ChevronDown, Cube, Ruler } from "@/components/ui/icons";

type Field = "name" | "email" | "phone" | "street" | "zip" | "city" | "company" | "ico" | "dic" | "note" | "terms";
/** Konkrétní hláška k poli, které API vrátí jako první chybné (`field`). */
const FIELD_MSG: Record<Field, string> = {
  name: "Vyplňte jméno a příjmení.",
  email: "Zkontrolujte e-mail.",
  phone: "Zkontrolujte telefon (aspoň 9 číslic).",
  street: "Vyplňte ulici a číslo popisné.",
  zip: "Zkontrolujte PSČ (5 číslic).",
  city: "Vyplňte město.",
  company: "Vyplňte název firmy.",
  ico: "IČO má 8 číslic.",
  dic: "DIČ ve tvaru CZ12345678 (nebo nechte prázdné).",
  note: "Poznámka je moc dlouhá (max. 1 000 znaků).",
  terms: "Potvrďte prosím obchodní podmínky.",
};

export function Checkout() {
  const { quote, loading, hydrated } = useQuote();
  const router = useRouter();
  const { items, carryUp, installRequested, calculationId, clear } = useCart();
  const [form, setForm] = useState({ name: "", email: "", phone: "", street: "", city: "", zip: "", business: false, company: "", ico: "", dic: "", note: "", terms: false });
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState<Field | null>(null);
  const [noteOpen, setNoteOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!hydrated || (loading && !quote)) return <div className="panel text-muted">Načítám…</div>;
  if (!quote || quote.lines.length === 0) return <div className="panel text-center py-12"><p className="h3">Košík je prázdný.</p><div className="mt-6 flex flex-wrap justify-center gap-3"><Link href="/kalkulacka" className="btn btn-accent"><Ruler className="h-4 w-4" /> Spočítat cenu</Link><Link href="/vizualizace" className="btn btn-outline"><Cube className="h-4 w-4" /> Byt ve 3D</Link></div></div>;

  const pallet = quote.shipments.some((s) => s.method === "pallet");
  const blocked = quote.lines.some((l) => l.blocked);
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (bad === k) { setBad(null); setErr(null); }
  };
  /** Označí chybné pole, rozbalí poznámku, pokud jde o ni, a dá poli focus (po vykreslení). */
  const fail = (f: Field) => {
    // Pole mají hlášku pod sebou; souhlas ji ukáže u tlačítka.
    flushSync(() => {
      setBad(f); setErr(f === "terms" ? FIELD_MSG[f] : null);
      if (f === "note") setNoteOpen(true);
      if (f === "company" || f === "ico" || f === "dic") setForm((x) => ({ ...x, business: true }));
    });
    document.getElementById(`c-${f}`)?.focus();
  };
  const inv = (f: Field) => (bad === f ? { "aria-invalid": true, "aria-describedby": `c-${f}-err` } : {});
  const errFor = (f: Field) => (bad === f ? <p id={`c-${f}-err`} className="text-sm text-danger mt-1.5">{FIELD_MSG[f]}</p> : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBad(null);
    if (blocked) return setErr("Nejdřív odeberte položky, které teď nejde objednat.");
    if (!form.terms) return fail("terms");
    setBusy(true);
    const { business, company, ico, dic, ...rest } = form;
    const customer = business ? { ...rest, business, company, ico, dic } : { ...rest, business: false };
    const res = await fetch("/api/orders", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ customer, items, carryUp, installRequested, calculationId }) }).catch(() => null);
    setBusy(false);
    if (!res) return setErr("Objednávku se nepodařilo odeslat — zkontrolujte připojení a zkuste to znovu.");
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (d.field && d.field in FIELD_MSG) return fail(d.field as Field);
      return setErr(d.error ?? "Objednávku se nepodařilo odeslat.");
    }
    const d = (await res.json()) as { id: string };
    clear();
    router.push(`/objednavka/${d.id}`);
  }

  const shipLabel = `Zásilky a termíny (${quote.shipments.length}) · doprava ${quote.shippingTotal === 0 ? "zdarma" : fmtCzk(quote.shippingTotal)}`;

  // Telefon: formulář → zásilky → platba → souhrn s tlačítkem (vše podstatné je nad tlačítkem).
  // Desktop: souhrn s tlačítkem vpravo přes oba řádky (sticky), vlevo formulář, zásilky a platba.
  return (
    <form onSubmit={submit} className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-y-8 lg:gap-x-12">
      <section className="panel space-y-4 min-w-0 lg:col-span-7 lg:col-start-1">
        <h2 className="h3">Dodací údaje</h2>
        <div><label className="label" htmlFor="c-name">Jméno a příjmení</label><input id="c-name" className="input" required minLength={2} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" autoCapitalize="words" enterKeyHint="next" {...inv("name")} />{errFor("name")}</div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="c-email">E-mail</label><input id="c-email" type="email" className="input" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" {...inv("email")} />{errFor("email")}</div>
          <div><label className="label" htmlFor="c-phone">Telefon (řidič vám zavolá)</label><input id="c-phone" type="tel" className="input" required minLength={9} value={form.phone} onChange={(e) => set("phone", e.target.value)} autoComplete="tel" enterKeyHint="next" {...inv("phone")} />{errFor("phone")}</div>
        </div>
        <div><label className="label" htmlFor="c-street">Ulice a č. p.</label><input id="c-street" className="input" required minLength={2} value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" enterKeyHint="next" {...inv("street")} />{errFor("street")}</div>
        <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
          <div><label className="label" htmlFor="c-zip">PSČ</label><input id="c-zip" className="input" required inputMode="numeric" pattern="[0-9]{3} ?[0-9]{2}" maxLength={6} title="PSČ ve tvaru 110 00" value={form.zip} onChange={(e) => set("zip", e.target.value)} autoComplete="postal-code" enterKeyHint="next" {...inv("zip")} />{errFor("zip")}</div>
          <div><label className="label" htmlFor="c-city">Město</label><input id="c-city" className="input" required minLength={2} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" enterKeyHint={noteOpen ? "next" : "done"} {...inv("city")} />{errFor("city")}</div>
        </div>

        <label className="check w-full min-h-11 text-sm"><input type="checkbox" className="h-5 w-5 shrink-0" checked={form.business} onChange={(e) => set("business", e.target.checked)} /><span>Nakupuji na firmu (doplním IČO / DIČ)</span></label>
        {form.business && (
          <div className="space-y-4 border-l-2 border-line pl-4">
            <div><label className="label" htmlFor="c-company">Název firmy</label><input id="c-company" className="input" required minLength={2} value={form.company} onChange={(e) => set("company", e.target.value)} autoComplete="organization" enterKeyHint="next" {...inv("company")} />{errFor("company")}</div>
            <div className="grid grid-cols-2 gap-4">
              <div><label className="label" htmlFor="c-ico">IČO</label><input id="c-ico" className="input" required inputMode="numeric" pattern="[0-9 ]{8,10}" maxLength={10} value={form.ico} onChange={(e) => set("ico", e.target.value)} enterKeyHint="next" {...inv("ico")} />{errFor("ico")}</div>
              <div><label className="label" htmlFor="c-dic">DIČ (nepovinné)</label><input id="c-dic" className="input" maxLength={14} placeholder="CZ12345678" autoCapitalize="characters" value={form.dic} onChange={(e) => set("dic", e.target.value)} enterKeyHint="next" {...inv("dic")} />{errFor("dic")}</div>
            </div>
          </div>
        )}

        {noteOpen ? (
          <div><label className="label" htmlFor="c-note">Poznámka pro řidiče (nepovinné)</label><textarea id="c-note" className="textarea" rows={2} maxLength={1000} placeholder="např. vjezd ze dvora" value={form.note} onChange={(e) => set("note", e.target.value)} {...inv("note")} />{errFor("note")}</div>
        ) : (
          <button type="button" className="inline-flex items-center min-h-11 text-sm link" onClick={() => { flushSync(() => setNoteOpen(true)); document.getElementById("c-note")?.focus(); }}>+ Poznámka pro řidiče</button>
        )}
      </section>

      <div className="space-y-8 min-w-0 lg:col-span-7 lg:col-start-1">
        <details className="group lg:hidden">
          <summary className="card flex items-center justify-between gap-3 px-4 min-h-12 cursor-pointer list-none [&::-webkit-details-marker]:hidden"><span className="min-w-0">{shipLabel}</span><ChevronDown className="h-4 w-4 shrink-0 transition-transform group-open:rotate-180" /></summary>
          <div className="mt-3"><ShipmentsView shipments={quote.shipments} showCarryUp={carryUp.enabled} /></div>
        </details>
        <section className="hidden lg:block">
          <h2 className="h3 mb-4">Zásilky a termíny</h2>
          <ShipmentsView shipments={quote.shipments} showCarryUp={carryUp.enabled} />
        </section>
        <section className="panel">
          <h2 className="h3">Platba převodem</h2>
          <p className="text-ink-soft mt-2">Platební údaje (číslo účtu, variabilní symbol) pošleme e-mailem s potvrzením objednávky do 1 pracovního dne. Zboží objednáme u dodavatele po připsání platby.</p>
        </section>
      </div>

      <aside className="min-w-0 lg:col-span-5 lg:col-start-8 lg:row-start-1 lg:row-span-2">
        <div className="panel lg:sticky lg:top-24">
          <p className="eyebrow">Shrnutí objednávky</p>
          <ul className="mt-4 divide-y divide-line text-sm">{quote.lines.map((l) => <li key={`${l.kind}-${l.id}`} className="py-2 flex justify-between gap-3"><span className={`min-w-0 truncate ${l.blocked ? "text-danger line-through" : ""}`}>{l.qty}× {l.name}</span><span className="tabular-nums shrink-0">{fmtCzk(l.lineTotal)}</span></li>)}</ul>
          <dl className="mt-3 space-y-1.5 text-sm border-t border-line pt-3">
            <div className="flex justify-between"><dt className="text-muted">Zboží</dt><dd className="tabular-nums">{fmtCzk(quote.itemsTotal)}</dd></div>
            <div className="flex justify-between"><dt className="text-muted">Doprava ({quote.shipments.length} {quote.shipments.length === 1 ? "zásilka" : quote.shipments.length < 5 ? "zásilky" : "zásilek"})</dt><dd className="tabular-nums">{quote.shippingTotal === 0 ? "zdarma" : fmtCzk(quote.shippingTotal)}</dd></div>
            {quote.carryUpTotal > 0 && <div className="flex justify-between"><dt className="text-muted">Vynáška</dt><dd className="tabular-nums">{fmtCzk(quote.carryUpTotal)}</dd></div>}
            <div className="flex justify-between"><dt className="text-muted">Platba</dt><dd>převodem</dd></div>
          </dl>
          <p className="text-xs text-muted mt-2">{carryUp.enabled ? carryUpText(carryUp, pallet) : <>Dovoz ke krajnici. <Link href="/kosik" className="link">Přidat vynášku</Link></>}</p>
          {installRequested && <p className="text-xs text-muted mt-1">Pokládka: podlahář z okolí se vám ozve s cenou.</p>}
          <div className="flex justify-between items-baseline border-t border-ink mt-3 pt-3"><span>Celkem vč. DPH</span><span className="text-2xl tabular-nums">{fmtCzk(quote.total)}</span></div>
          {blocked && <div className="mt-4"><BlockedNotice lines={quote.lines} /></div>}
          <label className="check w-full min-h-11 mt-4 text-sm items-start py-1"><input id="c-terms" type="checkbox" className="h-5 w-5 shrink-0 mt-0.5" checked={form.terms} onChange={(e) => set("terms", e.target.checked)} {...inv("terms")} /><span>Souhlasím s <Link href="/obchodni-podminky" target="_blank" className="link">obchodními podmínkami</Link> a beru na vědomí <Link href="/reklamacni-rad" target="_blank" className="link">reklamační řád</Link>.</span></label>
          {err && <p id={bad === "terms" ? "c-terms-err" : undefined} className="notice notice-danger text-sm mt-3" role="alert">{err}</p>}
          <button className="btn btn-accent btn-lg w-full mt-4" disabled={busy || blocked} aria-disabled={busy || blocked}>{busy ? "Odesílám…" : "Objednat s povinností platby"}</button>
          <p className="text-xs text-muted mt-3">Osobní údaje zpracujeme pro vyřízení objednávky a doručení (předáme dodavateli a dopravci). Více v <Link href="/ochrana-osobnich-udaju" target="_blank" className="link">zásadách ochrany osobních údajů</Link>. Od smlouvy můžete <Link href="/odstoupeni-od-smlouvy" target="_blank" className="link">odstoupit do 14 dnů</Link>.</p>
          <Link href="/kosik" className="btn btn-ghost w-full mt-2 text-ink-soft">Zpět do košíku</Link>
        </div>
      </aside>
    </form>
  );
}
