/** @type {import('next').NextConfig} */
const nextConfig = {
  // libSQL ships a native binary; load it from node_modules instead of bundling it.
  serverExternalPackages: ["@libsql/client", "libsql"],
  experimental: {
    // The /api proxy (proxy.ts) defaults to a 30 s timeout; AI drafts can take a minute or two.
    proxyTimeout: 180_000,
  },
};

export default nextConfig;
