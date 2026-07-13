import type { NextConfig } from "next";

const isPagesBuild = process.env.GITHUB_ACTIONS === "true";
const repositoryName = process.env.GITHUB_REPOSITORY?.split("/")[1] ?? "whats-next-roulette";
const basePath = isPagesBuild ? `/${repositoryName}` : "";

const nextConfig: NextConfig = {
  ...(isPagesBuild ? { output: "export" as const } : {}),
  basePath,
  assetPrefix: basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  ...(isPagesBuild ? { typescript: { tsconfigPath: "tsconfig.pages.json" } } : {}),
};

export default nextConfig;
