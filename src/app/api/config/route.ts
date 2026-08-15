export const dynamic = "force-dynamic";

/**
 * The Firebase web config, served at runtime.
 *
 * These values are public by design (security comes from the ID-token checks on
 * the server). Serving them instead of only inlining them at build time means a
 * deployment picks up new Firebase settings on restart, without a rebuild.
 */
export function GET() {
  return Response.json({
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? process.env.FIREBASE_API_KEY ?? null,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? process.env.FIREBASE_AUTH_DOMAIN ?? null,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? process.env.FIREBASE_PROJECT_ID ?? null,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? process.env.FIREBASE_APP_ID ?? null,
    messagingSenderId:
      process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ??
      process.env.FIREBASE_MESSAGING_SENDER_ID ??
      null,
  });
}
