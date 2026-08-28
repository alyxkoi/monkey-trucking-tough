import { MapPin, Phone } from "lucide-react";
import { Link } from "react-router-dom";
import logo from "@/assets/monkey-trucking-logo.webp";
import crushedConcrete from "@/assets/materials/crushed-concrete.webp";

const Footer = ({ clearMobileActions = false }: { clearMobileActions?: boolean }) => (
  <footer className={`public-footer ${clearMobileActions ? "public-footer-clear-mobile-actions" : ""}`}>
    <div className="public-footer-inner">
      <div className="public-footer-main">
        <div className="public-footer-brand">
          <img src={logo} alt="Monkey Trucking LLC" className="public-footer-logo" />
          <div className="public-footer-contact-row">
            <MapPin aria-hidden="true" />
            <address>7653 S FM 148<br />Kaufman, TX 75142</address>
          </div>
          <a href="tel:+12146778466" className="public-footer-phone">
            <Phone aria-hidden="true" />
            <span>214-677-8466</span>
          </a>
        </div>

        <nav className="public-footer-navigation" aria-label="Footer navigation">
          <div className="public-footer-nav-group">
            <h2>Explore</h2>
            <Link to="/">Home</Link>
            <Link to="/blog">Blog</Link>
          </div>
          <div className="public-footer-nav-group">
            <h2>Work</h2>
            <Link to="/services">Services</Link>
            <Link to="/materials">Materials</Link>
            <Link to="/projects">Projects</Link>
          </div>
          <div className="public-footer-nav-group">
            <h2>Connect</h2>
            <Link to="/contact">Contact</Link>
          </div>
        </nav>
      </div>

      <div className="public-footer-legal">
        <p>© {new Date().getFullYear()} Monkey Trucking LLC. All rights reserved.</p>
        <nav aria-label="Legal navigation">
          <Link to="/privacy-policy">Privacy Policy</Link>
          <Link to="/terms">Terms &amp; Conditions</Link>
        </nav>
      </div>
    </div>

    <div className="public-footer-aggregate" aria-hidden="true">
      <img src={crushedConcrete} alt="" loading="lazy" decoding="async" className="public-footer-rocks public-footer-rocks-left" />
      <img src={crushedConcrete} alt="" loading="lazy" decoding="async" className="public-footer-rocks public-footer-rocks-center" />
      <img src={crushedConcrete} alt="" loading="lazy" decoding="async" className="public-footer-rocks public-footer-rocks-right" />
    </div>
  </footer>
);

export default Footer;
