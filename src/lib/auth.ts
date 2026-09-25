import crypto from "node:crypto";
import { cookies } from "next/headers";

const COOKIE = "vp_admin";
const SECRET = process.env.ADMIN_SECRET ?? "dev-admin-secret-change-me";
const USER = process.env.ADMIN_USER ?? "admin";
const PASS = process.env.ADMIN_PASSWORD ?? "admin";
const TTL = 12 * 3600;

function sign(payload: string) {
  return crypto.createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function checkCredentials(user: string, pass: string) {
  const a = Buffer.from(`${user}\n${pass}`);
  const b = Buffer.from(`${USER}\n${PASS}`);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export function makeSessionValue() {
  const exp = Math.floor(Date.now() / 1000) + TTL;
  const payload = `${USER}.${exp}`;
  return `${payload}.${sign(payload)}`;
}

export function verifySession(value: string | undefined) {
  if (!value) return false;
  const i = value.lastIndexOf(".");
  if (i < 0) return false;
  const payload = value.slice(0, i);
  const sig = value.slice(i + 1);
  const exp = Number(payload.split(".")[1]);
  if (!Number.isFinite(exp) || exp * 1000 < Date.now()) return false;
  const expected = sign(payload);
  return sig.length === expected.length && crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected));
}

export async function isAdmin() {
  const c = await cookies();
  return verifySession(c.get(COOKIE)?.value);
}

export async function setSession() {
  const c = await cookies();
  c.set(COOKIE, makeSessionValue(), { httpOnly: true, sameSite: "lax", path: "/", maxAge: TTL, secure: process.env.NODE_ENV === "production" });
}

export async function clearSession() {
  const c = await cookies();
  c.delete(COOKIE);
}

export async function requireAdmin() {
  if (!(await isAdmin())) throw new Error("Unauthorized");
}
