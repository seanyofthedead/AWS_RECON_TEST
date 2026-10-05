import { User, type UserManagerSettings } from "oidc-client-ts";
import { cognitoAuthConfig } from "../auth/oidcConfig";

export const getApiBaseUrl = (): string => {
  const envUrl = (import.meta.env.VITE_API_BASE_URL ?? "").trim();
  return envUrl;
};

export const buildApiUrl = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const baseUrl = getApiBaseUrl();
  if (!baseUrl) {
    return normalizedPath;
  }
  return `${baseUrl}${normalizedPath}`;
};

// react-oidc-context keeps the signed-in user in sessionStorage under this key
// (oidc-client-ts default store).
const getAccessToken = (): string | null => {
  const { authority, client_id } = cognitoAuthConfig as UserManagerSettings;
  const key = `oidc.user:${authority}:${client_id}`;
  const stored = sessionStorage.getItem(key);
  if (!stored) {
    return null;
  }
  const user = User.fromStorageString(stored);
  return user.expired ? null : user.access_token;
};

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = getAccessToken();
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

