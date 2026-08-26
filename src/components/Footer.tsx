import { Link } from "react-router-dom";
import { Phone, MapPin } from "lucide-react";
import ContactActionSheet from "@/components/ContactActionSheet";
import logo from "@/assets/monkey-trucking-logo.webp";

const Footer = () => {
  return (
    <footer className="bg-industrial text-industrial-foreground">
      <div className="container mx-auto px-4 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {/* Logo & About */}
          <div>
            <img src={logo} alt="Monkey Trucking LLC" className="h-16 w-auto mb-4" />
            <p className="text-body text-gravel mt-4">
              Reliable hauling, aggregate delivery, and dirt work serving Kaufman County and surrounding areas.
            </p>
          </div>

          {/* Navigation */}
          <div>
            <h4 className="font-heading text-h4 text-primary mb-4">NAVIGATION</h4>
            <nav className="flex flex-col gap-2">
              {[
                { label: "Home", to: "/" },
                { label: "Services", to: "/services" },
                { label: "Materials", to: "/materials" },
                { label: "Projects", to: "/projects" },
                { label: "Contact", to: "/contact" },
                { label: "Blog", to: "/blog" },
              ].map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="text-body text-gravel hover:text-primary transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

          {/* Services */}
          <div>
            <h4 className="font-heading text-h4 text-primary mb-4">SERVICES</h4>
            <ul className="flex flex-col gap-2 text-body text-gravel">
              <li>Driveway & Private Road Construction</li>
              <li>Pond Construction</li>
              <li>Dirt Work</li>
              <li>Aggregate Hauling</li>
              <li>Material Delivery</li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-heading text-h4 text-primary mb-4">CONTACT</h4>
            <div className="flex flex-col gap-4 text-body text-gravel">
              <ContactActionSheet>
                {({ onClick }) => (
                  <button
                    onClick={onClick}
                    className="flex items-center gap-2 hover:text-primary transition-colors"
                  >
                    <Phone className="h-5 w-5 text-primary" />
                    Call or Text for Quote
                  </button>
                )}
              </ContactActionSheet>
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-primary mt-1 shrink-0" />
                <span>
                  7653 S FM 148<br />
                  Kaufman, TX
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gravel/20 mt-12 pt-8 text-center text-small text-gravel">
          © {new Date().getFullYear()} Monkey Trucking LLC. All rights reserved.
        </div>
      </div>
    </footer>
  );
};

export default Footer;
