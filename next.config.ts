import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.join(__dirname),
  serverExternalPackages: ["mongoose", "mongodb", "bcryptjs", "web-push"],
  experimental: {
    serverActions: {
      bodySizeLimit: "12mb"
    }
  }
};

export default nextConfig;
