import crypto from "node:crypto";
import type { EmailType } from "./types";

/**
 * Odhlášení z marketingových e-mailů. Token = base64url(e-mail) + "." + HMAC(e-mail) — odkaz v e-mailu tak nese adresu
 * i podpis a nikdo nemůže odhlásit cizí adresu. Secret: EMAIL_SECRET, jinak ADMIN_SECRET (fallback jako v auth.ts).
 */
const SECRET = process.env.EMAIL_SECRET ?? process.env.ADMIN_SECRET ?? "dev-admin-secret-change-me";

/** Marketingové (souhlasové) e-maily — ruší se při odhlášení. Transakční (potvrzení vzorků, kalkulace na e-mail) ne. */
export const MARKETING_EMAIL_TYPES: readonly EmailType[] = ["sample-reminder-calc", "sample-discount"];

const norm = (email: string) => email.trim().toLowerCase();
const sign = (email: string) => crypto.createHmac("sha256", SECRET).update(`unsubscribe:${email}`).digest("base64url").slice(0, 32);

export function unsubscribeToken(email: string) {
  const e = norm(email);
  return `${Buffer.from(e).toString("base64url")}.${sign(e)}`;
}

/** Vrátí e-mail z platného tokenu, jinak null. */
export function verifyUnsubscribeToken(token: string | undefined | null): string | null {
  if (!token || token.length > 600) return null;
  const i = token.lastIndexOf(".");
  if (i <= 0) return null;
  let email: string;
  try { email = Buffer.from(token.slice(0, i), "base64url").toString("utf8"); } catch { return null; }
  const sig = token.slice(i + 1);
  const expected = sign(norm(email));
  if (sig.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return norm(email);
}

export function unsubscribeUrl(email: string) {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://vinylpodlahy.cz";
  return `${base}/odhlaseni?token=${encodeURIComponent(unsubscribeToken(email))}`;
}
