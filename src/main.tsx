import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "react-oidc-context";
import { App } from "./App";
import "./styles/tailwind.css";
import { cognitoAuthConfig } from "./auth/oidcConfig";
import { RequireAuth } from "./auth/RequireAuth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30
    }
  }
});

const container = document.getElementById("root");

if (!container) {
  throw new Error("Root container missing in index.html");
}

createRoot(container).render(
  <StrictMode>
    <AuthProvider
      {...cognitoAuthConfig}
      onSigninCallback={cognitoAuthConfig.onSigninCallback}
    >
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <RequireAuth>
            <App />
          </RequireAuth>
        </BrowserRouter>
      </QueryClientProvider>
    </AuthProvider>
  </StrictMode>
);
