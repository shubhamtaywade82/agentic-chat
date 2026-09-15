import path from "path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  transpilePackages: ["chart-sdk", "binance-client-ts"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  // The MCP SDK uses Node.js built-ins (child_process, etc.) and should not
  // be bundled into the Next.js server runtime. Listing it here tells
  // Next.js to require it from node_modules at runtime instead.
  serverExternalPackages: ["@modelcontextprotocol/sdk"],
  turbopack: {
    root: path.resolve(__dirname),
  },
  webpack: (config) => {
    config.resolve = config.resolve || {};
    config.resolve.modules = [
      path.resolve(__dirname, "node_modules"),
      ...(config.resolve.modules || ["node_modules"]),
    ];
    return config;
  },
};

export default nextConfig;

