import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Phone, Menu, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import ContactActionSheet from "@/components/ContactActionSheet";
import UserMenu from "@/components/auth/UserMenu";
import { initialsFor, useAuth } from "@/hooks/useAuth";
import logo from "@/assets/monkey-trucking-logo.webp";

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

  useEffect(() => {
    setMobileOpen(false);
  }, [location]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  return (
    <>
      <header className="public-header fixed inset-x-0 top-0 z-50">
        <div className="container mx-auto flex h-[76px] items-center justify-between px-4">
          {/* Spacer for mobile centering */}
          <div className="w-10 lg:hidden" />
          <Link to="/" className="flex items-center gap-3 lg:mr-auto">
            <img src={logo} alt="Monkey Trucking LLC" className="h-[60px] w-auto" />
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-9">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className={`public-nav-link font-['Barlow_Semi_Condensed'] text-base font-bold uppercase ${
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-industrial-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
          </nav>

          <div className="hidden lg:flex items-center gap-4 ml-8">
            <ContactActionSheet>
              {({ onClick }) => (
                <Button onClick={onClick} className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-6 h-12 transition-transform hover:-translate-y-0.5">
                  <Phone className="mr-2 h-5 w-5" />
                  CALL / TEXT FOR QUOTE
                </Button>
              )}
            </ContactActionSheet>
            <UserMenu />
          </div>


          {/* Mobile hamburger */}
          <button
            className="lg:hidden text-industrial-foreground p-2"
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            aria-expanded={mobileOpen}
          >
            <Menu size={28} />
          </button>
        </div>
      </header>

      <div
        className={`public-drawer-backdrop fixed inset-0 z-50 transition-opacity duration-[280ms] motion-reduce:duration-0 lg:hidden ${mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"}`}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />
      <aside
        className={`public-drawer-panel fixed bottom-0 right-0 top-0 z-[60] flex w-[82vw] max-w-[320px] flex-col transition-transform ease-out motion-reduce:transition-opacity motion-reduce:duration-0 lg:hidden ${mobileOpen ? "translate-x-0 duration-[280ms]" : "translate-x-full duration-[240ms]"}`}
        aria-hidden={!mobileOpen}
      >
        <div className="px-5 pt-5">
          <div className="flex items-start justify-between">
            <img src={logo} alt="Monkey Trucking LLC" className="h-16 w-auto max-w-[210px] object-contain object-left" />
            <button className="flex h-12 w-12 items-center justify-center text-industrial-foreground" onClick={() => setMobileOpen(false)} aria-label="Close menu">
              <X size={28} />
            </button>
          </div>
        </div>
        <nav className="mt-8 flex flex-col px-5">
            {navLinks.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setMobileOpen(false)}
                className={`flex min-h-[52px] items-center font-['Barlow_Semi_Condensed'] text-xl font-semibold uppercase transition-colors hover:text-primary ${
                  location.pathname === link.to
                    ? "text-primary"
                    : "text-industrial-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
        </nav>
        <div className="mt-auto">
          <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />
          <div className="px-5 py-3">
            {user ? (
              <Link
                to="/admin"
                onClick={() => setMobileOpen(false)}
                className="flex min-h-12 w-full items-center gap-3 font-['Barlow_Semi_Condensed'] text-base font-semibold uppercase text-industrial-foreground/75 transition-colors hover:text-industrial-foreground"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-industrial-foreground/10 text-sm text-industrial-foreground">
                  {initialsFor(user)}
                </span>
                Tickets
              </Link>
            ) : (
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setMobileOpen(false);
                  window.setTimeout(() => navigate("/signin"), 260);
                }}
                className="min-h-12 w-full justify-start gap-3 px-0 font-['Barlow_Semi_Condensed'] text-base font-semibold uppercase text-industrial-foreground/75 hover:bg-transparent hover:text-industrial-foreground"
              >
                <span className="flex h-9 w-9 items-center justify-center rounded-full border border-industrial-foreground/15">
                  <UserIcon className="h-4 w-4" />
                </span>
                Sign in
              </Button>
            )}
          </div>
          <div className="h-px w-full bg-[rgba(255,255,255,0.08)]" />
          <div className="px-5 py-6 pb-[max(24px,env(safe-area-inset-bottom))]">
            <ContactActionSheet>
              {({ onClick }) => (
                <Button onClick={onClick} className="h-14 w-full bg-primary font-heading text-h4 tracking-wider text-primary-foreground hover:bg-primary/85">
                  <Phone className="mr-2 h-5 w-5" />
                  CALL / TEXT FOR QUOTE
                </Button>
              )}
            </ContactActionSheet>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Header;
