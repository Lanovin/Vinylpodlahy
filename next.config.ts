import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Ověřovací buildy (Claude) jdou do jiné složky, aby nerozbily cache běžícího `next dev` v .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  /* config options here */
};

export default nextConfig;
