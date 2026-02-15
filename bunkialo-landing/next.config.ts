import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qr.expo.dev",
      },
    ],
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
