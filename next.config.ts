import type { NextConfig } from "next";

// GitHub Pages (https://ap-study-lab.github.io/ap-study/) 向けの静的エクスポート設定
const basePath = "/ap-study";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
