/**
 * Loads a local .env for processes started outside Next.js (the server entry
 * point and the seed script). On Railway the variables are already in the
 * environment, so this is a no-op there.
 */
export function loadLocalEnv() {
  if (process.env.DATABASE_URL) return;
  try {
    process.loadEnvFile();
  } catch {
    /* no .env file — the platform supplies the variables */
  }
}
