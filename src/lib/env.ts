/** Server-side configuration, read once and validated on first use. */

function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing required environment variable ${name}`);
  return value;
}

export const serverEnv = {
  get firebaseProjectId() {
    return required(
      "FIREBASE_PROJECT_ID",
      process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    );
  },
  /**
   * Optional: a Google account that is also treated as an examiner. Examiners
   * normally sign in with the shared username and password below.
   */
  get examinerEmail() {
    return process.env.EXAMINER_EMAIL?.trim().toLowerCase() ?? "";
  },
  /** Shared examiner credentials. Any number of people may be signed in at once. */
  get adminUsername() {
    return (process.env.ADMIN_USERNAME || "examiner").trim();
  },
  get adminPassword() {
    return process.env.ADMIN_PASSWORD ?? "";
  },
  /**
   * Signing key for examiner session cookies. Falls back to a value derived
   * from the password so the login still works if the key was never set —
   * changing the password then invalidates existing sessions, which is fine.
   */
  get sessionSecret() {
    return process.env.ADMIN_SESSION_SECRET || `derived:${process.env.ADMIN_PASSWORD ?? ""}`;
  },
  get euriApiKey() {
    return process.env.EURI_API_KEY?.trim() ?? "";
  },
  get euriBaseUrl() {
    return (process.env.EURI_BASE_URL || "https://api.euron.one/api/v1/euri").replace(/\/+$/, "");
  },
  get euriModel() {
    return process.env.EURI_MODEL || "gemini-2.5-pro";
  },
};
