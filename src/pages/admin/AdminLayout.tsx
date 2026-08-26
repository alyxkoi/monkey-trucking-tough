import { useEffect, useState } from "react";
import { Link, Navigate, Outlet, useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { FileText, LogOut, Plus, Settings as SettingsIcon } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { flushQueue, getQueue } from "@/lib/admin/tickets";
import { useQueryClient } from "@tanstack/react-query";
import "@/styles/admin.css";
import logo from "@/assets/monkey-trucking-logo.webp";

const AdminLayout = () => {
  const { user, loading, signOut } = useAuth();
  const { pathname } = useLocation();
  const queryClient = useQueryClient();
  const [pending, setPending] = useState(0);

  useEffect(() => {
    const sync = async () => {
      const synced = await flushQueue();
      if (synced) queryClient.invalidateQueries({ queryKey: ["admin", "tickets"] });
      setPending(getQueue().length);
    };
    const update = () => setPending(getQueue().length);
    update();
    void sync();
    window.addEventListener("online", sync);
    window.addEventListener("mt-queue-change", update);
    const interval = window.setInterval(sync, 30000);
    return () => {
      window.removeEventListener("online", sync);
      window.removeEventListener("mt-queue-change", update);
      window.clearInterval(interval);
    };
  }, [queryClient]);

  if (loading) {
    return (
      <>
        <Helmet>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="adm" />
      </>
    );
  }

  if (!user) return <Navigate to="/" replace />;

  const onNew = pathname === "/admin/new" || pathname.endsWith("/edit");
  const nav = [
    { to: "/admin", label: "Dashboard", icon: FileText, active: pathname === "/admin" || (pathname.startsWith("/admin/ticket/") && !onNew) },
    { to: "/admin/new", label: "New ticket", icon: Plus, active: onNew },
    { to: "/admin/settings", label: "Settings", icon: SettingsIcon, active: pathname.startsWith("/admin/settings") },
  ];

  return (
    <div className="adm adm-shell">
      <Helmet>
        <title>Admin — Monkey Trucking</title>
        <meta name="robots" content="noindex, nofollow" />
        <meta name="googlebot" content="noindex, nofollow" />
        <meta name="theme-color" content="#0E0E10" />
      </Helmet>

      <aside className="adm-side">
        <img src={logo} alt="Monkey Trucking" className="h-14 w-full object-contain object-left" />
        <nav className="mt-8 space-y-2">
          {nav.map((item) => <Link key={item.to} to={item.to} className="adm-side-link" data-active={item.active}><item.icon size={20}/><span>{item.label}</span></Link>)}
        </nav>
        <div className="mt-auto border-t pt-4" style={{ borderColor:"var(--adm-line)" }}>
          <p className="mb-3 truncate text-sm" style={{color:"var(--adm-text-2)"}}>{user.email}</p>
          <button type="button" onClick={() => void signOut()} className="adm-side-link w-full"><LogOut size={20}/><span>Sign out</span></button>
        </div>
      </aside>

      <div className="adm-content">
      {pending > 0 && (
        <div
          className="adm-label px-4 py-3"
          style={{ background: "rgba(255,159,10,0.12)", color: "var(--adm-amber)", margin: 0 }}
        >
          {pending} ticket{pending > 1 ? "s" : ""} waiting to sync
        </div>
      )}

      <Outlet />
      </div>
      {!onNew && <nav className="adm-bottom-nav" data-active-index={Math.max(0, nav.findIndex((item) => item.active))} aria-label="Admin navigation"><span className="adm-bottom-nav-indicator" aria-hidden="true" />{nav.map((item) => <Link key={item.to} to={item.to} aria-label={item.label} className="adm-nav-icon" data-active={item.active}><item.icon size={22}/></Link>)}</nav>}
    </div>
  );
};

export default AdminLayout;
