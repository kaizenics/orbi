import pkg from "./package.json" with { type: "json" };

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Shown in the account menu.
  env: { NEXT_PUBLIC_APP_VERSION: pkg.version },
  // The dev-only Next.js badge would cover the travel chat button in the bottom-right corner.
  devIndicators: { position: "bottom-left" },
  // libSQL ships a native binary; load it from node_modules instead of bundling it.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // The /api proxy (proxy.ts) defaults to a 30 s timeout; AI drafts can take a minute or two.
    proxyTimeout: 180_000,
  },
};

export default nextConfig;
