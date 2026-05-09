import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Audio version uploads (POST /api/songs/[id]/versions) accept files up
    // to 500MB. Without this, proxy.ts clones the body with a 10MB default,
    // truncating larger audio files before the route handler reads them.
    proxyClientMaxBodySize: "500mb",
  },
};

export default nextConfig;
