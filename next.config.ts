import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  // A stray package-lock.json in the parent folder (outside this project
  // entirely) makes Turbopack infer that as the workspace root instead of
  // this directory - which then loads .env.local from the wrong place, so
  // local dev silently runs without SUPABASE_SERVICE_ROLE_KEY etc. even
  // though .env.local here has them. Pinning the root removes the guess.
  turbopack: {
    root: path.join(__dirname),
  },
  // Same-origin route to Supabase. If a browser can't reach *.supabase.co
  // directly (ISP/DNS block, extension, flaky route) lib/supabase/net.ts
  // falls back to /sb/*, which only needs our own site to be reachable.
  async rewrites() {
    const target = process.env.NEXT_PUBLIC_SUPABASE_URL
    return target ? [{ source: '/sb/:path*', destination: `${target}/:path*` }] : []
  },
  async headers() {
    return [{ source: '/sb/:path*', headers: [{ key: 'Cache-Control', value: 'no-store' }] }]
  },
};

export default nextConfig;
