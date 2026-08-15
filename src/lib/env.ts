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
  /** The one Google account allowed to run exams. */
  get examinerEmail() {
    return required("EXAMINER_EMAIL", process.env.EXAMINER_EMAIL).trim().toLowerCase();
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
