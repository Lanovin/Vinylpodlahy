"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CONSENT_CATEGORIES, CONSENT_OPEN_EVENT, readConsent, saveConsent, type Consent } from "@/lib/consent";

/** CSS proměnná s výškou lišty od spodního okraje okna — fixní spodní lišty webu používají `bottom-[var(--cookie-h,0px)]`. */
const VAR = "--cookie-h";
const setCookieH = (px: number) => document.documentElement.style.setProperty(VAR, `${Math.max(0, Math.round(px))}px`);

/**
 * Lišta se souhlasem s cookies. Do volby běží vše v režimu „denied“ (Consent Mode v2, viz Gtm.tsx).
 * „Odmítnout“ a „Přijmout“ jsou stejně výrazná tlačítka. Znovu se otevře událostí z CookieSettingsButton.
 *
 * Vrstvy: z-[55] — nad hlavičkou (z-50) a spodními lištami (z-40), ale POD modály (mobilní menu z-60, filtry z-70,
 * 3D dialog z-80), takže otevřené menu / panel lišta nikdy nezakryje. Spodní lišty se nad ni posunou přes --cookie-h.
 */
export function CookieBanner() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState(false);
  const [prefs, setPrefs] = useState<Consent>({ analytics: false, marketing: false });
  const ref = useRef<HTMLDivElement>(null);
  const hidden = !open || pathname.startsWith("/admin");

  useEffect(() => {
    // Cookie jde číst až v prohlížeči; po hydrataci, aby se SSR a klient shodly.
    const init = setTimeout(() => {
      const stored = readConsent();
      if (stored) setPrefs(stored);
      else setOpen(true);
    }, 0);
    const reopen = () => {
      const current = readConsent();
      if (current) setPrefs(current);
      setSettings(true);
      setOpen(true);
    };
    window.addEventListener(CONSENT_OPEN_EVENT, reopen);
    return () => {
      clearTimeout(init);
      window.removeEventListener(CONSENT_OPEN_EVENT, reopen);
    };
  }, []);

  // Měření: kolik místa lišta zabírá od spodního okraje okna (mění se s textem, nastavením i otočením telefonu).
  useEffect(() => {
    const el = ref.current;
    if (hidden || !el) { setCookieH(0); return; }
    const measure = () => setCookieH(window.innerHeight - el.getBoundingClientRect().top);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("resize", measure);
    return () => { ro.disconnect(); window.removeEventListener("resize", measure); setCookieH(0); };
  }, [hidden, settings]);

  if (hidden) return null;

  const decide = (c: Consent) => {
    saveConsent(c);
    setPrefs(c);
    setOpen(false);
    setSettings(false);
  };

  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-title"
      className="fade-up fixed z-[55] inset-x-0 bottom-0 sm:inset-x-auto sm:left-4 sm:bottom-4 sm:w-[26rem] max-h-[85dvh] overflow-y-auto rounded-t-lg sm:rounded-lg border-t sm:border border-line bg-surface px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-5 shadow-card"
    >
      <h2 id="cookie-title" className="text-base sm:text-xl leading-snug">Cookies</h2>
      <p className="mt-1 sm:mt-2 text-sm leading-snug sm:leading-relaxed text-ink-soft">
        {settings
          ? "Vyberte, co smíme používat. Volbu kdykoli změníte v patičce webu."
          : "Nezbytné používáme vždy. Analytické a marketingové jen s vaším souhlasem."}{" "}
        <Link href="/cookies" className="link whitespace-nowrap">Zásady cookies</Link>
      </p>

      {settings && (
        <ul className="mt-3 divide-y divide-line border-y border-line">
          {CONSENT_CATEGORIES.map((c) => {
            const necessary = c.key === "necessary";
            const id = `cookie-${c.key}`;
            return (
              <li key={c.key} className="flex items-start justify-between gap-4 py-3">
                <label htmlFor={id} className="min-w-0 flex-1 cursor-pointer">
                  <span className="block text-[.95rem]">{c.title}</span>
                  <span className="mt-0.5 block text-[.8rem] leading-snug text-muted">{c.text}</span>
                </label>
                <input
                  id={id}
                  type="checkbox"
                  role="switch"
                  className="switch mt-0.5"
                  checked={necessary || prefs[c.key as keyof Consent]}
                  disabled={necessary}
                  onChange={(e) => !necessary && setPrefs((p) => ({ ...p, [c.key]: e.target.checked }))}
                />
              </li>
            );
          })}
        </ul>
      )}

      {/* Telefon: tři tlačítka v jedné řadě (lišta je nízká); odmítnutí a přijetí stejně výrazné. */}
      <div className="mt-3 sm:mt-4 grid grid-cols-3 sm:grid-cols-2 gap-2">
        {settings ? (
          <button type="button" className="btn btn-outline btn-sm !h-11 px-2 sm:order-last sm:col-span-2" onClick={() => decide(prefs)}>Uložit výběr</button>
        ) : (
          <button type="button" className="btn btn-ghost btn-sm !h-11 px-2 underline underline-offset-2 sm:no-underline sm:order-last sm:col-span-2" onClick={() => setSettings(true)}><span>Nastavit<span className="hidden sm:inline">&nbsp;podrobně</span></span></button>
        )}
        <button type="button" className="btn btn-primary btn-sm !h-11 px-2" onClick={() => decide({ analytics: false, marketing: false })}><span>Odmítnout<span className="hidden sm:inline">&nbsp;vše</span></span></button>
        <button type="button" className="btn btn-primary btn-sm !h-11 px-2" onClick={() => decide({ analytics: true, marketing: true })}><span>Přijmout<span className="hidden sm:inline">&nbsp;vše</span></span></button>
      </div>
    </div>
  );
}

/** Odkaz do patičky (a na stránku Zásady cookies), který lištu znovu otevře v podrobném nastavení. */
export function CookieSettingsButton({ className, label = "Nastavení cookies" }: { className?: string; label?: string }) {
  return (
    <button type="button" className={className} onClick={() => window.dispatchEvent(new Event(CONSENT_OPEN_EVENT))}>
      {label}
    </button>
  );
}
