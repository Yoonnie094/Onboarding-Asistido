import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // El borrador del onboarding (con polígonos y filas de planilla) viaja completo en cada autosave.
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
