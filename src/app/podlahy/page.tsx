import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import { CATALOG_META_DESCRIPTION, type SearchParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vinylové a SPC podlahy: katalog s filtry", description: CATALOG_META_DESCRIPTION, alternates: { canonical: "/podlahy" } };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <CatalogView sp={await searchParams} />;
}
