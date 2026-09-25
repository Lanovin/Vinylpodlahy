import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { loginAction } from "../actions";
import { LogoMark } from "@/components/layout/Logo";

export const metadata = { title: "Přihlášení do administrace", robots: { index: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  if (await isAdmin()) redirect("/admin");
  const { err } = await searchParams;
  return (
    <div className="min-h-screen grid place-items-center bg-ink text-white p-4">
      <form action={loginAction} className="w-full max-w-sm bg-surface text-ink rounded-lg p-8 space-y-4 shadow-2xl">
        <div className="flex items-center gap-3 mb-2"><LogoMark className="h-8 w-8" /><div><p className="text-lg leading-none">vinylpodlahy.cz</p><p className="eyebrow mt-1">Administrace</p></div></div>
        <div><label className="label" htmlFor="user">Uživatel</label><input id="user" name="user" className="input" autoComplete="username" defaultValue="admin" required /></div>
        <div><label className="label" htmlFor="password">Heslo</label><input id="password" name="password" type="password" className="input" autoComplete="current-password" required /></div>
        {err && <p className="notice notice-danger text-sm">Nesprávné jméno nebo heslo.</p>}
        <button className="btn btn-primary w-full">Přihlásit se</button>
        <p className="text-xs text-muted">Demo přístup: admin / admin. Změňte přes ADMIN_USER a ADMIN_PASSWORD v .env.</p>
      </form>
    </div>
  );
}
