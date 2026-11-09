/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // The /api proxy (proxy.ts) defaults to a 30 s timeout; AI drafts can take a minute or two.
    proxyTimeout: 180_000,
  },
};

export default nextConfig;
