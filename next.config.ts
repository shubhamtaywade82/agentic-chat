import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["chart-sdk", "binance-client-ts"],
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // The MCP SDK uses Node.js built-ins (child_process, etc.) and should not
  // be bundled into the Next.js server runtime. Listing it here tells
  // Next.js to require it from node_modules at runtime instead.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
};

export default nextConfig;

