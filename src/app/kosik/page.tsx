import type { Metadata } from "next";
import { Site } from "@/components/layout/Site";
import { CartView } from "@/components/cart/CartView";
import { settings as settingsRepo } from "@/lib/db/repos";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Košík", robots: { index: false } };

export default function Page() {
  const s = settingsRepo.get();
  return (
    <Site>
      <div className="container py-6 md:py-14">
        <h1 className="h2 mb-5 md:mb-8">Košík</h1>
        <CartView freeFromM2={s.freeShippingFromM2} carryUpParcel={s.shipping.carryUpParcelPrice} carryUpPalletPerFloor={s.shipping.carryUpPalletPricePerFloor} />
      </div>
    </Site>
  );
}
