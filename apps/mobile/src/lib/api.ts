import { createOrbiClient } from "@orbi/api/client";

export { ApiError, unwrap } from "@orbi/api/client";

export const apiUrl = process.env.EXPO_PUBLIC_API_URL;

/**
 * Typed client for the ORBI server. The token is baked into the app bundle, which is acceptable
 * for a personal build; Phase 6 moves URL and token to an in-app settings screen (expo-secure-store).
 */
export const api = createOrbiClient(apiUrl ?? "http://10.0.2.2:3100", {
  token: process.env.EXPO_PUBLIC_API_TOKEN || undefined,
});
