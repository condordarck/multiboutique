import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["pg"],
  transpilePackages: ["@multiboutique/metier", "@multiboutique/shared"],
};

export default nextConfig;