import type { AuthProviderProps } from "react-oidc-context";

const env = import.meta.env as Record<string, string | undefined>;

const requiredEnvVars = [
  "VITE_COGNITO_REGION",
  "VITE_COGNITO_USER_POOL_ID",
  "VITE_COGNITO_USER_POOL_CLIENT_ID",
  "VITE_COGNITO_DOMAIN"
];

const missingEnvVars = requiredEnvVars.filter((key) => {
  const value = env[key];
  return !value || value.trim().length === 0;
});

if (missingEnvVars.length > 0) {
  throw new Error(
    `Missing required environment variables: ${missingEnvVars.join(", ")}`
  );
}

const parseRedirectList = (value: string) =>
  value
    .split(",")
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);

const ensureTrailingSlash = (value: string) =>
  value.endsWith("/") ? value : `${value}/`;

const getWindowOrigin = () => {
  if (typeof window === "undefined") {
    return "";
  }
  return window.location.origin;
};

const getRedirectEnvKey = (kind: "signin" | "signout") => {
  const isProduction = import.meta.env.MODE === "production";
  if (isProduction) {
    return kind === "signin" ? "VITE_APP_REDIRECT_SIGN_IN" : "VITE_APP_REDIRECT_SIGN_OUT";
  }
  if (kind === "signin" && env.VITE_APP_REDIRECT_SIGN_IN_LOCAL) {
    return "VITE_APP_REDIRECT_SIGN_IN_LOCAL";
  }
  if (kind === "signout" && env.VITE_APP_REDIRECT_SIGN_OUT_LOCAL) {
    return "VITE_APP_REDIRECT_SIGN_OUT_LOCAL";
  }
  return kind === "signin" ? "VITE_APP_REDIRECT_SIGN_IN" : "VITE_APP_REDIRECT_SIGN_OUT";
};

export const pickRedirectUri = (kind: "signin" | "signout"): string => {
  const key = getRedirectEnvKey(kind);
  const entries = parseRedirectList(env[key] ?? "");
  const origin = getWindowOrigin();
  const match = origin ? entries.find((entry) => entry.startsWith(origin)) : undefined;
  if (match) {
    return ensureTrailingSlash(match);
  }
  if (entries[0]) {
    return ensureTrailingSlash(entries[0]);
  }
  return ensureTrailingSlash(origin || "/");
};

export const getCognitoHostedUiBase = (): string => {
  return `https://${env.VITE_COGNITO_DOMAIN}`;
};

export const buildLogoutUrl = (logoutUri: string): string => {
  const clientId = env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? "";
  return `${getCognitoHostedUiBase()}/logout?client_id=${encodeURIComponent(
    clientId
  )}&logout_uri=${encodeURIComponent(logoutUri)}`;
};

export const cognitoAuthConfig: AuthProviderProps = {
  authority: `https://cognito-idp.${env.VITE_COGNITO_REGION}.amazonaws.com/${env.VITE_COGNITO_USER_POOL_ID}`,
  client_id: env.VITE_COGNITO_USER_POOL_CLIENT_ID ?? "",
  response_type: "code",
  scope: "openid email profile",
  redirect_uri: pickRedirectUri("signin"),
  post_logout_redirect_uri: pickRedirectUri("signout"),
  onSigninCallback: () => {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};
