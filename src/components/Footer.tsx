import { MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/monkey-trucking-logo.webp";

const Footer = ({ clearMobileActions = false }: { clearMobileActions?: boolean }) => (
  <footer className={`overflow-hidden bg-[#101012] text-white ${clearMobileActions ? "pb-[70px] md:pb-0" : ""}`}>
    <div className="mx-auto max-w-[1380px] px-5 pb-8 pt-14 sm:px-8 lg:px-12 lg:pt-18">
      <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-12 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col items-start">
          <img src={logo} alt="Monkey Trucking LLC" className="h-[76px] w-auto" />
          <div className="mt-6 flex items-start gap-3 text-base leading-relaxed text-white/[0.62]">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>7653 S FM 148<br />Kaufman, TX 75142</span>
          </div>
        </div>

        <div className="lg:border-l lg:border-white/10 lg:pl-12">
          <p className="font-label text-base font-semibold text-white/[0.52]">Call Monkey Trucking</p>
          <a href="tel:+12146778466" className="mt-2 inline-flex min-h-14 items-center gap-4 font-heading text-[clamp(40px,6vw,76px)] leading-none tracking-wide text-white transition-colors duration-200 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <Phone className="h-7 w-7 text-primary sm:h-9 sm:w-9" />
            214-677-8466
          </a>
          <nav className="mt-8 grid grid-cols-2 gap-x-7 gap-y-1 border-t border-white/10 pt-6 font-label text-base font-semibold sm:grid-cols-3" aria-label="Footer navigation">
            {[
              ["Home", "/"], ["Services", "/services"], ["Materials", "/materials"],
              ["Projects", "/projects"], ["Contact", "/contact"], ["Blog", "/blog"],
            ].map(([label, to]) => <Link key={to} to={to} className="flex min-h-11 items-center text-white/66 transition-colors hover:text-primary">{label}</Link>)}
          </nav>
        </div>
      </div>

      <div className="pointer-events-none select-none overflow-hidden border-b border-white/10 py-5 font-heading text-[clamp(58px,11vw,152px)] uppercase leading-[0.78] tracking-[0.01em] text-white/[0.055]" aria-hidden="true">
        Monkey Trucking
      </div>

      <div className="flex flex-col gap-4 pt-7 text-sm text-white/[0.52] sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Monkey Trucking LLC. All rights reserved.</p>
        <nav className="flex flex-wrap gap-x-5 gap-y-2" aria-label="Legal navigation">
          <Link to="/privacy-policy" className="hover:text-white">Privacy Policy</Link>
          <Link to="/terms" className="hover:text-white">Terms &amp; Conditions</Link>
          <Link to="/contact" className="hover:text-white">Contact</Link>
        </nav>
      </div>
    </div>
  </footer>
);

export default Footer;
