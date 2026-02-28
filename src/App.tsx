import { lazy, Suspense, useEffect } from "react";
import { NavLink, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { ToastManager } from "./components/ToastManager";
import { SignOutButton } from "./auth/SignOutButton";
import { RouteSkeleton } from "./components/RouteSkeleton";
import { markRouteStart } from "./utils/perf";
import { useDataProvider } from "./hooks/useDataProvider";

const ExecutiveSummaryPage = lazy(() =>
  import("./pages/ExecutiveSummaryPage").then((module) => ({
    default: module.ExecutiveSummaryPage
  }))
);
const InboxPage = lazy(() =>
  import("./pages/InboxPage").then((module) => ({ default: module.InboxPage }))
);
const CasePage = lazy(() =>
  import("./pages/CasePage").then((module) => ({ default: module.CasePage }))
);
const EscalationsPage = lazy(() =>
  import("./pages/EscalationsPage").then((module) => ({
    default: module.EscalationsPage
  }))
);
const ResolvedCasesPage = lazy(() =>
  import("./pages/ResolvedCasesPage").then((module) => ({
    default: module.ResolvedCasesPage
  }))
);
const SettingsPage = lazy(() =>
  import("./pages/SettingsPage").then((module) => ({
    default: module.SettingsPage
  }))
);

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-md px-3 py-2 text-sm font-semibold ${
    isActive ? "bg-slate-900 text-white" : "text-slate-600 hover:text-slate-900"
  }`;

export const App = () => {
  const location = useLocation();
  const queryClient = useQueryClient();
  const dataProvider = useDataProvider();

  useEffect(() => {
    markRouteStart(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    void queryClient.prefetchQuery({
      queryKey: ["cases"],
      queryFn: () => dataProvider.getCases()
    });
    void queryClient.prefetchQuery({
      queryKey: ["escalations"],
      queryFn: () => dataProvider.getEscalations()
    });
  }, [queryClient, dataProvider]);

  return (
    <div className="min-h-screen bg-slate-25 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-6 py-5 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-lg font-semibold">Agentic Reconciliation</h1>
            <p className="text-sm text-slate-600">
              Decision workspace for reconciliation cases.
            </p>
          </div>
          <nav className="flex flex-wrap gap-2">
            <NavLink
              to="/executive"
              className={navLinkClass}
              onClick={() => markRouteStart("/executive")}
            >
              Executive Summary
            </NavLink>
            <NavLink to="/inbox" className={navLinkClass} onClick={() => markRouteStart("/inbox")}>
              Inbox
            </NavLink>
            <NavLink
              to="/escalations"
              className={navLinkClass}
              onClick={() => markRouteStart("/escalations")}
            >
              Escalations
            </NavLink>
            <NavLink
              to="/resolved"
              className={navLinkClass}
              onClick={() => markRouteStart("/resolved")}
            >
              Resolved
            </NavLink>
            <NavLink
              to="/settings"
              className={navLinkClass}
              onClick={() => markRouteStart("/settings")}
            >
              Settings
            </NavLink>
          </nav>
          <div className="flex w-full justify-end md:w-auto">
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        <Suspense fallback={<RouteSkeleton />}>
          <Routes>
            <Route path="/" element={<Navigate to="/executive" replace />} />
            <Route path="/executive" element={<ExecutiveSummaryPage />} />
            <Route path="/inbox" element={<InboxPage />} />
            <Route path="/resolved" element={<ResolvedCasesPage />} />
            <Route path="/cases/:caseId" element={<CasePage />} />
            <Route path="/escalations" element={<EscalationsPage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="*" element={<Navigate to="/executive" replace />} />
          </Routes>
        </Suspense>
      </main>
      <ToastManager />
    </div>
  );
};
