const apiUrl = process.env.ORBI_API_URL ?? "http://127.0.0.1:3100";

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Browser calls stay same-origin (/api/*); Next forwards them to the ORBI server.
  async rewrites() {
    return [{ source: "/api/:path*", destination: `${apiUrl}/:path*` }];
  },
};

export default nextConfig;
