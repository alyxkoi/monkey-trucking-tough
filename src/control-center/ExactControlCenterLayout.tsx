import { Helmet } from "react-helmet-async";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useAdminAccess } from "@/hooks/admin/useAdminAccess";
import { ControlCenterProvider } from "@/control-center/context";
import { AppStateProvider } from "@/control-center/approved/state/AppState";
import { AppShell } from "@/control-center/approved/components/shell/AppShell";
import { useDemoMode } from "@/control-center/demo/DemoMode";

function LoadingGate() {
  return (
    <div className="control-center-root min-h-screen">
      <Helmet>
        <meta name="robots" content="noindex, nofollow" />
      </Helmet>
    </div>
  );
}

export default function ExactControlCenterLayout() {
  const { user, loading } = useAuth();
  const demo = useDemoMode();
  const access = useAdminAccess(user?.id);
  const { pathname } = useLocation();
  const isOverview = pathname === "/admin" || pathname === "/admin/";

  if (!demo.enabled && (loading || (!!user && access.isLoading))) return <LoadingGate />;
  if (!demo.enabled && (!user || !access.authorized)) return <Navigate to="/signin" replace />;

  return (
    <div className={`control-center-root ${isOverview ? "cc-overview-canvas" : "cc-tab-canvas"}`}>
      <Helmet>
        <title>Control Center · Monkey Trucking</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="theme-color" content="#101115" />
      </Helmet>
      <ControlCenterProvider>
        <AppStateProvider>
          <AppShell />
        </AppStateProvider>
      </ControlCenterProvider>
    </div>
  );
}
