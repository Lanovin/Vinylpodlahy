import type { Metadata } from "next";
import { Site } from "@/components/layout/Site";
import { Checkout } from "@/components/cart/Checkout";

export const metadata: Metadata = { title: "Objednávka", robots: { index: false } };

export default function Page() {
  return (
    <Site>
      <div className="container py-10 md:py-14"><h1 className="h2 mb-8">Dokončení objednávky</h1><Checkout /></div>
    </Site>
  );
}
