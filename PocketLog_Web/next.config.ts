import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // Authenticated financial pages are request-specific. Keep partial prerendering off
  // so cookies and owner-scoped database reads never participate in a shared shell.
  cacheComponents: false,
  reactCompiler: true,
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
