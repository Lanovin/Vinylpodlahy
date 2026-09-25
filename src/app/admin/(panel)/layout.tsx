import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdmin } from "@/lib/auth";
import { alerts, leads, orders, sampleRequests } from "@/lib/db/repos";
import { logoutAction } from "../actions";
import { LogoMark } from "@/components/layout/Logo";
import { AdminNav } from "@/components/admin/AdminNav";

export const dynamic = "force-dynamic";
export const metadata = { title: { default: "Administrace", template: "%s | Admin vinylpodlahy.cz" }, robots: { index: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  if (!(await isAdmin())) redirect("/admin/login");
  const counts = {
    alerts: alerts.open().length,
    orders: orders.all().filter((o) => o.status === "new").length,
    leads: leads.all().filter((l) => l.status === "new").length,
    samples: sampleRequests.all().filter((s) => s.status === "new").length,
  };
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[240px_1fr] bg-bg">
      <aside className="bg-ink text-white/80 lg:min-h-screen">
        <div className="p-5 flex items-center justify-between border-b border-white/10">
          <Link href="/admin" className="flex items-center gap-2 text-white"><LogoMark className="h-7 w-7" /><span className="tracking-wider text-sm">ADMIN</span></Link>
          <Link href="/" className="text-xs text-white/50 hover:text-white">→ web</Link>
        </div>
        <AdminNav counts={counts} />
        <form action={logoutAction} className="p-5 border-t border-white/10 mt-auto"><button className="text-sm text-white/60 hover:text-white">Odhlásit se</button></form>
      </aside>
      <main className="p-4 md:p-8 min-w-0">{children}</main>
    </div>
  );
}
