import { Phone } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import ContactActionSheet from "@/components/ContactActionSheet";

interface CTASectionProps {
  headline: string;
  subtext: string;
  showContact?: boolean;
}

const CTASection = ({ headline, subtext, showContact = true }: CTASectionProps) => {
  return (
    <section className="bg-primary py-20 md:py-24">
      <div className="container mx-auto px-4 text-center">
        <h2 className="font-heading text-h1 text-primary-foreground mb-4">{headline}</h2>
        <p className="text-body text-primary-foreground/90 mb-8 max-w-2xl mx-auto">{subtext}</p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <ContactActionSheet>
            {({ onClick }) => (
              <Button onClick={onClick} className="bg-industrial !text-white hover:bg-industrial/90 font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] transition-transform hover:-translate-y-0.5">
                <Phone className="mr-2 h-5 w-5" />
                CALL NOW
              </Button>
            )}
          </ContactActionSheet>
          {showContact && (
            <Link to="/contact">
              <Button
                variant="outline"
                className="border-2 border-primary-foreground text-primary-foreground hover:bg-primary-foreground hover:text-primary font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] transition-transform hover:-translate-y-0.5"
              >
                CONTACT US
              </Button>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
};

export default CTASection;
