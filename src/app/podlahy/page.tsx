import type { Metadata } from "next";
import { CatalogView } from "@/components/catalog/CatalogView";
import type { SearchParams } from "@/lib/catalog";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Vinylové a SPC podlahy — katalog s filtry", description: "Katalog vinylových a SPC podlah s filtry podle typu, tloušťky, nášlapné vrstvy, třídy zátěže, ceny za m² a dostupnosti v m²." };

export default async function Page({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return <CatalogView sp={await searchParams} />;
}
