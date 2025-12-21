import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export", // Required for ICP static hosting
  images: {
    unoptimized: true, // ICP does not support Node.js image optimization
  },
  env: {
    NEXT_PUBLIC_CANISTER_ID_TRADEWEAVER_BACKEND: process.env.CANISTER_ID_TRADEWEAVER_BACKEND,
    NEXT_PUBLIC_DFX_NETWORK: process.env.DFX_NETWORK || "local",
  },
  // Disable server-side features for static export
  trailingSlash: true,
};

export default nextConfig;
