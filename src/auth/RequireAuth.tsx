import type { ReactNode } from "react";
import { useEffect, useRef } from "react";
import { useAuth } from "react-oidc-context";

type RequireAuthProps = {
  children: ReactNode;
};

export const RequireAuth = ({ children }: RequireAuthProps) => {
  const auth = useAuth();
  const hasTriggeredSignin = useRef(false);

  useEffect(() => {
    if (!auth.isLoading && !auth.isAuthenticated && !hasTriggeredSignin.current) {
      hasTriggeredSignin.current = true;
      void auth.signinRedirect();
    }
  }, [auth]);

  if (auth.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Loading...
      </div>
    );
  }

  if (auth.error) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-700">
        Authentication error: {auth.error.message}
      </div>
    );
  }

  if (!auth.isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center text-slate-600">
        Redirecting to sign in...
      </div>
    );
  }

  return <>{children}</>;
};
