import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Prisma client and the pg driver are Node-only; keep them out of the
  // bundler so the server build does not try to trace their native pieces.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg"],
};

export default config;
