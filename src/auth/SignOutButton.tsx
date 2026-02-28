import { useState } from "react";
import { useAuth } from "react-oidc-context";
import { buildLogoutUrl, pickRedirectUri } from "./oidcConfig";

export const SignOutButton = () => {
  const auth = useAuth();
  const [isProcessing, setIsProcessing] = useState(false);

  const handleSignOut = async () => {
    if (isProcessing) {
      return;
    }

    setIsProcessing(true);
    try {
      await auth.removeUser();
      const logoutUri = pickRedirectUri("signout");
      window.location.assign(buildLogoutUrl(logoutUri));
    } catch (error) {
      console.error("Failed to sign out", error);
      setIsProcessing(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={isProcessing}
      className="rounded-md border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {isProcessing ? "Signing out..." : "Sign out"}
    </button>
  );
};
