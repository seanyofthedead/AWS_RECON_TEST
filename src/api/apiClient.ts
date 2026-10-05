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

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {})
    }
  });
  if (!response.ok) {
    throw new Error(`API request failed: ${response.status} ${response.statusText}`);
  }
  return (await response.json()) as T;
}

