import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { CatalogView } from "@/components/catalog/CatalogView";
import { LANDINGS, landingBySlug, type SearchParams } from "@/lib/catalog";
import { content as contentRepo } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
export const dynamicParams = false;
export function generateStaticParams() { return LANDINGS.map((l) => ({ landing: l.slug })); }

export async function generateMetadata({ params }: { params: Promise<{ landing: string }> }): Promise<Metadata> {
  const { landing } = await params;
  const t = contentRepo.get().landings[landing];
  if (!t) return {};
  return { title: { absolute: t.metaTitle }, description: t.metaDescription, alternates: { canonical: `/${landing}` } };
}

export default async function Page({ params, searchParams }: { params: Promise<{ landing: string }>; searchParams: Promise<SearchParams> }) {
  const { landing } = await params;
  const def = landingBySlug(landing);
  if (!def) notFound();
  return <CatalogView sp={await searchParams} landing={def} />;
}
