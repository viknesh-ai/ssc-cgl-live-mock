import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // The Prisma client and the pg driver are Node-only; keep them out of the
  // bundler so the server build does not try to trace their native pieces.
  serverExternalPackages: ["@prisma/client", "@prisma/adapter-pg", "pg", "unpdf", "mammoth"],

  /**
   * Serve Firebase's sign-in handler from our own domain.
   *
   * By default the handler lives on <project>.firebaseapp.com, which makes
   * Google sign-in a cross-site flow. Mobile Safari and other browsers that
   * block third-party storage refuse it, so sign-in works on desktop Chrome and
   * fails on phones. Proxying the handler makes the whole flow first-party.
   */
  async rewrites() {
    const authDomain =
      process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN;
    if (!authDomain) return [];
    return [
      { source: "/__/auth/:path*", destination: `https://${authDomain}/__/auth/:path*` },
      { source: "/__/firebase/:path*", destination: `https://${authDomain}/__/firebase/:path*` },
    ];
  },
};

export default config;
