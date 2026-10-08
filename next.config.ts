import type { NextConfig } from "next";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * Verze souborů vizualizace (public/visualizer) = otisk jejich obsahu. Adresy souborů ji nesou v `?v=`
 * (engine/assets.ts), takže se smí cachovat napořád — po novém výpočtu světla (`npm run bake:viz`) se
 * otisk, a tím i adresa, změní. Druhá návštěva tak nestahuje ani bajt.
 */
function vizAssetVersion() {
  try {
    const dir = path.join(process.cwd(), "public", "visualizer");
    const hash = createHash("sha1");
    for (const f of readdirSync(dir).sort()) hash.update(f).update(readFileSync(path.join(dir, f)));
    return hash.digest("hex").slice(0, 10);
  } catch {
    return "";
  }
}

const nextConfig: NextConfig = {
  // Ověřovací buildy (Claude) jdou do jiné složky, aby nerozbily cache běžícího `next dev` v .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  env: { NEXT_PUBLIC_VIZ_ASSET_V: vizAssetVersion() },
  async headers() {
    return [
      {
        source: "/visualizer/:file*",
        has: [{ type: "query", key: "v" }],
        headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
      },
    ];
  },
};

export default nextConfig;
