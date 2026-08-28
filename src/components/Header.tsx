import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Menu, Phone, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import UserMenu from "@/components/auth/UserMenu";
import { initialsFor, useAuth } from "@/hooks/useAuth";
import logo from "@/assets/monkey-trucking-logo.webp";
import { preloadPublicRoute, preloadPublicRoutes } from "@/publicRouteLoaders";

const PHONE_HREF = "tel:+12146778466";
const navLinks = [
  { label: "Home", to: "/" },
  { label: "Services", to: "/services" },
  { label: "Materials", to: "/materials" },
  { label: "Projects", to: "/projects" },
  { label: "Contact", to: "/contact" },
];

const Header = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => setMobileOpen(false), [location.pathname]);
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);
  useEffect(() => {
    const schedule = window.requestIdleCallback ?? ((callback: IdleRequestCallback) => window.setTimeout(callback, 400));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    const id = schedule(() => preloadPublicRoutes());
    return () => cancel(id);
  }, []);

  return (
    <>
      <header className="public-header fixed inset-x-0 top-0 z-50">
        <div className="mx-auto flex h-[76px] max-w-[1440px] items-center px-4 sm:px-6 lg:px-8">
          <Link to="/" className="shrink-0" aria-label="Monkey Trucking home">
            <img src={logo} alt="Monkey Trucking LLC" className="h-[58px] w-auto" />
          </Link>

          <nav className="ml-auto hidden items-center gap-7 lg:flex" aria-label="Primary navigation">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onMouseEnter={() => preloadPublicRoute(link.to)}
                onFocus={() => preloadPublicRoute(link.to)}
                aria-current={location.pathname === link.to ? "page" : undefined}
                className={`public-nav-link font-label text-base font-bold uppercase ${location.pathname === link.to ? "text-primary" : "text-white"}`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="ml-7 hidden items-center gap-3 lg:flex">
            <Button asChild variant="outline" className="h-12 border-white/25 bg-transparent px-5 font-heading text-lg tracking-wider text-white hover:bg-white hover:text-nearblack">
              <Link to="/contact">GET A QUOTE</Link>
            </Button>
            <Button asChild className="h-12 bg-primary px-5 font-heading text-lg tracking-wider text-white hover:bg-primary/85">
              <a href={PHONE_HREF}><Phone className="mr-2 h-5 w-5" />CALL NOW</a>
            </Button>
            <UserMenu />
          </div>

          <button type="button" className="ml-auto flex h-12 w-12 items-center justify-center text-white lg:hidden" onClick={() => setMobileOpen(true)} aria-label="Open menu" aria-expanded={mobileOpen}>
            <Menu size={30} />
          </button>
        </div>
      </header>

      <div className={`public-drawer-backdrop fixed inset-0 z-50 transition-opacity duration-200 motion-reduce:duration-0 lg:hidden ${mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`} onClick={() => setMobileOpen(false)} aria-hidden="true" />
      <aside className={`public-drawer-panel fixed bottom-0 right-0 top-0 z-[60] flex w-[86vw] max-w-[360px] flex-col transition-transform duration-200 motion-reduce:duration-0 lg:hidden ${mobileOpen ? "translate-x-0" : "translate-x-full"}`} aria-hidden={!mobileOpen}>
        <div className="flex items-center justify-between px-5 pt-5">
          <img src={logo} alt="Monkey Trucking LLC" className="h-16 w-auto max-w-[220px] object-contain object-left" />
          <button type="button" className="flex h-12 w-12 items-center justify-center text-white" onClick={() => setMobileOpen(false)} aria-label="Close menu"><X size={30} /></button>
        </div>

        <nav className="mt-7 flex flex-col px-5" aria-label="Mobile navigation">
          {navLinks.map((link) => (
            <Link key={link.to} to={link.to} onFocus={() => preloadPublicRoute(link.to)} aria-current={location.pathname === link.to ? "page" : undefined} className={`flex min-h-[54px] items-center border-b border-white/[0.08] font-label text-xl font-bold uppercase ${location.pathname === link.to ? "text-primary" : "text-white"}`}>
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-5 pb-[max(24px,env(safe-area-inset-bottom))]">
          <div className="mb-5 border-t border-white/10 pt-4">
            {user ? (
              <Link to="/admin" className="flex min-h-12 items-center gap-3 font-label text-base font-semibold text-white/70">
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-sm text-white">{initialsFor(user)}</span>
                Control Center
              </Link>
            ) : (
              <button type="button" onClick={() => { setMobileOpen(false); window.setTimeout(() => navigate("/signin"), 200); }} className="flex min-h-12 w-full items-center gap-3 font-label text-base font-semibold text-white/70">
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15"><UserIcon className="h-4 w-4" /></span>
                Sign in
              </button>
            )}
          </div>
          <div className="grid gap-3">
            <a href={PHONE_HREF} className="public-button public-button-primary w-full"><Phone className="h-5 w-5" />Call Now</a>
            <Link to="/contact" className="public-button public-button-dark-outline w-full">Get a Quote</Link>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Header;
