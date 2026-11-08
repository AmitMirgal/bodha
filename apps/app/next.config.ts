import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  transpilePackages: [
    "@repo/design-system",
    "@repo/observability",
    "@repo/ai",
  ],
  serverExternalPackages: ["@mastra/core"],
};

export default config;
