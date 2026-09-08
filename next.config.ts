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
};

export default nextConfig;
