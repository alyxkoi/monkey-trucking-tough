import { MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/monkey-trucking-logo.webp";

const Footer = () => (
  <footer className="bg-nearblack text-white">
    <div className="mx-auto max-w-[1380px] px-5 py-12 sm:px-8 lg:px-12 lg:py-14">
      <div className="grid grid-cols-1 gap-10 border-b border-white/10 pb-10 md:grid-cols-[1fr_auto_auto] md:items-start">
        <div>
          <img src={logo} alt="Monkey Trucking LLC" className="h-16 w-auto" />
          <div className="mt-5 flex items-start gap-3 text-base leading-relaxed text-white/65">
            <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <span>7653 S FM 148<br />Kaufman, TX 75142</span>
          </div>
        </div>

        <nav className="grid grid-cols-2 gap-x-8 gap-y-3 font-label text-base font-semibold" aria-label="Footer navigation">
          {[
            ["Home", "/"], ["Services", "/services"], ["Materials", "/materials"],
            ["Projects", "/projects"], ["Contact", "/contact"], ["Blog", "/blog"],
          ].map(([label, to]) => <Link key={to} to={to} className="flex min-h-11 items-center text-white/70 hover:text-primary">{label}</Link>)}
        </nav>

        <div>
          <a href="tel:+12146778466" className="inline-flex min-h-12 items-center gap-3 font-heading text-2xl tracking-wide text-white hover:text-primary">
            <Phone className="h-5 w-5 text-primary" />
            214-677-8466
          </a>
          <p className="mt-2 max-w-[280px] text-base leading-relaxed text-white/60">Based in Kaufman. Serving Kaufman County and surrounding DFW areas.</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 pt-7 text-sm text-white/55 sm:flex-row sm:items-center sm:justify-between">
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
