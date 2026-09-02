import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

interface CTASectionProps {
  headline: string;
  subtext: string;
  showContact?: boolean;
  quoteTo?: string;
  showServices?: boolean;
  quoteFirst?: boolean;
  className?: string;
}

const CTASection = ({ headline, subtext, showContact = true, quoteTo = "/contact", showServices = false, quoteFirst = false, className = "" }: CTASectionProps) => (
  <section className={`bg-primary py-14 sm:py-16 lg:py-20 ${className}`}>
    <div className="mx-auto max-w-[980px] px-5 text-center sm:px-8">
      <h2 className="font-heading text-[clamp(42px,6vw,72px)] uppercase leading-[0.94] text-white">{headline}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/90">{subtext}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        {showContact && quoteFirst && <Link to={quoteTo} className="public-button border-2 border-white bg-white text-primary hover:bg-transparent hover:text-white">Get a Quote</Link>}
        <a href="sms:+12146778466" className="public-button bg-industrial text-white hover:bg-[#242428]"><MessageSquare className="h-5 w-5" />Text 214-677-8466</a>
        {showContact && !quoteFirst && <Link to={quoteTo} className="public-button border-2 border-white bg-white text-primary hover:bg-transparent hover:text-white">Get a Quote</Link>}
        {showServices && <Link to="/services" className="public-button border border-white/70 text-white hover:bg-white/10">View All Services</Link>}
      </div>
    </div>
  </section>
);

export default CTASection;
