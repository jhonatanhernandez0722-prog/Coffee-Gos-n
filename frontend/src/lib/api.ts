const productionApiUrl = "https://backend-lemon-five-80.vercel.app/api/v1";
const developmentApiUrl = "http://localhost:8001/api/v1";

const configuredApiUrl = process.env.NEXT_PUBLIC_API_URL?.trim();

export const apiUrl = configuredApiUrl && /^https?:\/\//i.test(configuredApiUrl)
  ? configuredApiUrl.replace(/\/+$/, "")
  : process.env.NODE_ENV === "production"
    ? productionApiUrl
    : developmentApiUrl;

export const apiBaseUrl = apiUrl.replace(/\/api\/v1$/, "");

export function userFacingError(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (/failed to fetch|networkerror|load failed/i.test(message)) return fallback;
  return message || fallback;
}