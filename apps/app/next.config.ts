import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
	reactStrictMode: true,
	transpilePackages: ["@repo/design-system", "@repo/observability", "@repo/ai"],
	serverExternalPackages: [
		"@mastra/core",
		"pg",
		"@prisma/adapter-pg",
		"@prisma/client",
	],
	turbopack: {
		root: path.join(__dirname, "../.."),
	},
};

export default config;
