import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silencia o conflito webpack/turbopack (Next.js 16 usa Turbopack por padrão)
  turbopack: {},
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
    ],
  },
  webpack: (config) => {
    // Necessário para pdf-parse funcionar em API routes do Next.js
    config.resolve.alias = {
      ...config.resolve.alias,
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
