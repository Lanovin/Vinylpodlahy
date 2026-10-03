"use client";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { flushSync } from "react-dom";
import type { PublicProduct } from "@/lib/public";
import { useCart, useHydrated } from "@/store/cart";
import { FLOOR_TYPE_LABEL } from "@/lib/types";
import { plural } from "@/lib/format";
import { SampleButton } from "@/components/product/SampleButton";
import { Cube, Trash } from "@/components/ui/icons";

type Field = "name" | "email" | "street" | "zip" | "city" | "productIds";
/** Konkrétní hláška k poli, které API vrátí jako první chybné (`field`). */
const FIELD_MSG: Record<Field, string> = {
  name: "Vyplňte jméno a příjmení.",
  email: "Zkontrolujte e-mail.",
  street: "Vyplňte ulici a číslo popisné.",
  zip: "Zkontrolujte PSČ (5 číslic).",
  city: "Vyplňte město.",
  productIds: "Vyberte alespoň jeden vzorek.",
};

const vzorku = (n: number) => `${n} ${plural(n, "vzorek", "vzorky", "vzorků")}`;

/** Tipy pro prázdnou vzorkovnici: aktivní dekory, střídavě podle odstínu (světlé dřevo, tmavé, šedé, kámen). */
function picks(products: PublicProduct[], n: number) {
  const byTone = new Map<string, PublicProduct[]>();
  for (const p of products) if (p.status === "active") byTone.set(p.decorTone, [...(byTone.get(p.decorTone) ?? []), p]);
  const groups = [...byTone.values()];
  const out: PublicProduct[] = [];
  for (let i = 0; out.length < n && groups.some((g) => g.length > i); i++) for (const g of groups) if (g[i] && out.length < n) out.push(g[i]);
  return out;
}

export function SamplesForm({ products, min, max }: { products: PublicProduct[]; min: number; max: number }) {
  const hydrated = useHydrated();
  const samples = useCart((s) => s.samples);
  const removeSample = useCart((s) => s.removeSample);
  const clearSamples = useCart((s) => s.clearSamples);
  const calculationId = useCart((s) => s.calculationId);
  const router = useRouter();
  const [form, setForm] = useState({ name: "", email: "", street: "", city: "", zip: "", marketing: false });
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState<Field | null>(null);
  const [busy, setBusy] = useState(false);
  /** Vybírá z mřížky tipů — mřížka pak zůstane nahoře i s vybranými vzorky, aby stránka neposkočila. */
  const [browsing, setBrowsing] = useState(false);
  /** Formulář s adresou je na obrazovce — lepivá lišta „Pokračovat“ (telefon) se pak schová. */
  const [formInView, setFormInView] = useState(false);
  const chosen = samples.map((id) => products.find((p) => p.id === id)).filter(Boolean) as PublicProduct[];
  const hasChosen = chosen.length > 0;

  useEffect(() => {
    const el = hydrated && hasChosen ? document.getElementById("adresa") : null;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setFormInView(e.isIntersecting), { rootMargin: "0px 0px -30% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [hydrated, hasChosen]);

  if (!hydrated) return <div className="panel text-muted">Načítám…</div>;

  const tips = chosen.length === 0 || browsing ? picks(products, 8) : [];
  const stickyBar = tips.length > 0 && hasChosen && !formInView;
  const left = max - chosen.length;
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (bad === k) { setBad(null); setErr(null); }
  };
  const fail = (f: Field) => {
    // Pole mají hlášku pod sebou; souhlas a výběr vzorků ji ukážou u tlačítka.
    flushSync(() => { setBad(f); setErr(f === "productIds" ? FIELD_MSG[f] : null); });
    document.getElementById(`s-${f}`)?.focus();
  };
  const inv = (f: Field) => (bad === f ? { "aria-invalid": true, "aria-describedby": `s-${f}-err` } : {});
  const errFor = (f: Field) => (bad === f ? <p id={`s-${f}-err`} className="text-sm text-danger mt-1.5">{FIELD_MSG[f]}</p> : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(null); setBad(null);
    if (chosen.length < min) return setErr(`Vyberte alespoň ${vzorku(min)}.`);
    setBusy(true);
    const res = await fetch("/api/samples", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ...form, productIds: chosen.map((p) => p.id), calculationId }) }).catch(() => null);
    setBusy(false);
    if (!res) return setErr("Odeslání se nepodařilo — zkontrolujte připojení a zkuste to znovu.");
    if (!res.ok) {
      const d = (await res.json().catch(() => ({}))) as { error?: string; field?: string };
      if (d.field && d.field in FIELD_MSG) return fail(d.field as Field);
      return setErr(d.error ?? "Odeslání se nepodařilo, zkuste to prosím znovu.");
    }
    clearSamples();
    router.push("/vzorky/odeslano");
  }

  return (
    <div className={`space-y-10 ${stickyBar ? "pb-20 lg:pb-0" : ""}`}>
      {tips.length > 0 && (
        <section>
          <h2 className="h3">Vyberte si dekory {chosen.length > 0 && <span className="text-muted text-base">{chosen.length}/{max}</span>}</h2>
          <ul className="mt-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3" onClickCapture={() => setBrowsing(true)}>
            {tips.map((p) => {
              const img = p.images.swatch ?? p.images.card;
              return (
                <li key={p.id} className="card overflow-hidden flex flex-col">
                  <Link href={`/podlaha/${p.slug}`} className="relative block aspect-[4/3] bg-bg">{img && <Image src={img} alt={p.decor} fill sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 45vw" className="object-cover" />}</Link>
                  <div className="p-2.5 sm:p-3 flex-1 flex flex-col gap-2">
                    <p className="text-sm leading-tight"><Link href={`/podlaha/${p.slug}`} className="hover:underline">{p.decor}</Link><span className="block text-xs text-muted mt-0.5">{FLOOR_TYPE_LABEL[p.type]}</span></p>
                    <SampleButton productId={p.id} max={max} size="sm" compact className="mt-auto [&>button]:w-full [&>button]:px-2" />
                  </div>
                </li>
              );
            })}
          </ul>
          {chosen.length === 0 ? (
            <div className="mt-6 flex flex-wrap gap-3"><Link href="/vizualizace" className="btn btn-accent"><Cube className="h-4 w-4" /> Byt ve 3D</Link><Link href="/podlahy" className="btn btn-outline">Katalog</Link></div>
          ) : (
            <a href="#adresa" className="btn btn-accent mt-6">Pokračovat · {vzorku(chosen.length)} ↓</a>
          )}
        </section>
      )}

      {chosen.length > 0 && (
        <div id="adresa" className="grid grid-cols-[minmax(0,1fr)] lg:grid-cols-12 gap-8 lg:gap-12 scroll-mt-24">
          <div className="lg:col-span-6">
            <div className="flex items-center justify-between"><h2 className="h3">Vybrané vzorky <span className="text-muted text-base">{chosen.length}/{max}</span></h2><button type="button" className="min-h-10 px-2 -mr-2 text-sm text-muted hover:text-ink" onClick={clearSamples}>Vyprázdnit</button></div>
            <ul className="mt-4 divide-y divide-line card">
              {chosen.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-3">
                  <div className="relative h-16 w-16 rounded-sm overflow-hidden bg-bg shrink-0">{p.images.swatch && <Image src={p.images.swatch} alt="" fill sizes="64px" className="object-cover" />}</div>
                  <div className="flex-1 min-w-0"><p className="eyebrow truncate">{p.brand} · {p.collection}</p><p className="leading-tight"><Link href={`/podlaha/${p.slug}`} className="hover:underline">{p.decor}</Link></p><p className="text-xs text-muted">{FLOOR_TYPE_LABEL[p.type]}</p></div>
                  <div className="flex items-center shrink-0 -mr-1">
                    <Link href={`/vizualizace?podlaha=${encodeURIComponent(p.slug)}`} className="btn btn-ghost btn-sm px-2"><Cube className="h-4 w-4" /> Ve 3D</Link>
                    <button type="button" className="h-10 w-10 grid place-items-center text-muted hover:text-danger" aria-label={`Odebrat vzorek ${p.decor}`} onClick={() => removeSample(p.id)}><Trash className="h-4 w-4" /></button>
                  </div>
                </li>
              ))}
            </ul>
            {left > 0 && !browsing && <p className="text-sm text-muted mt-3">Můžete přidat ještě {vzorku(left)} — z <Link href="/podlahy" className="link">katalogu</Link> nebo <Link href="/vizualizace" className="link">ve 3D</Link>.</p>}
            <div className="notice notice-info text-sm mt-6">Poštou zdarma do 3–5 pracovních dnů. Nic neplatíte.</div>
          </div>
          <form onSubmit={submit} className="lg:col-span-6 panel space-y-4">
            <h2 className="h3">Kam vzorky pošleme</h2>
            <div><label className="label" htmlFor="s-name">Jméno a příjmení</label><input id="s-name" className="input" required minLength={2} value={form.name} onChange={(e) => set("name", e.target.value)} autoComplete="name" autoCapitalize="words" enterKeyHint="next" {...inv("name")} />{errFor("name")}</div>
            <div><label className="label" htmlFor="s-email">E-mail</label><input id="s-email" type="email" className="input" required value={form.email} onChange={(e) => set("email", e.target.value)} autoComplete="email" autoCapitalize="none" spellCheck={false} enterKeyHint="next" {...inv("email")} />{errFor("email")}</div>
            <div><label className="label" htmlFor="s-street">Ulice a č. p.</label><input id="s-street" className="input" required minLength={2} value={form.street} onChange={(e) => set("street", e.target.value)} autoComplete="address-line1" enterKeyHint="next" {...inv("street")} />{errFor("street")}</div>
            <div className="grid grid-cols-[120px_minmax(0,1fr)] gap-4">
              <div><label className="label" htmlFor="s-zip">PSČ</label><input id="s-zip" className="input" required inputMode="numeric" pattern="[0-9]{3} ?[0-9]{2}" maxLength={6} title="PSČ ve tvaru 110 00" value={form.zip} onChange={(e) => set("zip", e.target.value)} autoComplete="postal-code" enterKeyHint="next" {...inv("zip")} /></div>
              <div><label className="label" htmlFor="s-city">Město</label><input id="s-city" className="input" required minLength={2} value={form.city} onChange={(e) => set("city", e.target.value)} autoComplete="address-level2" enterKeyHint="done" {...inv("city")} /></div>
            </div>
            {errFor("zip")}{errFor("city")}
            <label className="check w-full text-sm items-start py-1 min-h-11"><input id="s-marketing" type="checkbox" className="h-5 w-5 shrink-0 mt-0.5" checked={form.marketing} onChange={(e) => set("marketing", e.target.checked)} /><span>Chci e-maily s radami k výběru a slevou <span className="text-muted">(nepovinné, odhlásíte se jedním klikem)</span></span></label>
            {err && <p id={bad === "productIds" ? "s-productIds-err" : undefined} className="notice notice-danger text-sm" role="alert">{err}</p>}
            <button className="btn btn-accent btn-lg w-full" disabled={busy}>{busy ? "Odesílám…" : `Poslat ${vzorku(chosen.length)} zdarma`}</button>
            <p className="text-xs text-muted">Adresu a e-mail použijeme k odeslání vzorků{form.marketing ? " a k e-mailům, které jste si zaškrtli" : ""}. Více v <Link href="/ochrana-osobnich-udaju" target="_blank" className="link">zásadách ochrany osobních údajů</Link>.</p>
            {calculationId && <p className="text-xs text-muted">K žádosti přiložíme i vaši uloženou kalkulaci, abyste ji měli po ruce.</p>}
          </form>
        </div>
      )}

      {/* Telefon: pokračování k adrese vždy na dosah palce, i když je výběr dekorů dlouhý. */}
      {stickyBar && (
        <div className="lg:hidden fixed inset-x-0 bottom-[var(--cookie-h,0px)] z-40 bg-bg/95 backdrop-blur border-t border-line pb-[env(safe-area-inset-bottom)]">
          <div className="container py-2.5 flex items-center gap-3">
            <p className="flex-1 min-w-0 text-sm text-muted">{chosen.length}/{max} vybráno</p>
            <a href="#adresa" className="btn btn-accent">Pokračovat · {vzorku(chosen.length)}</a>
          </div>
        </div>
      )}
    </div>
  );
}
