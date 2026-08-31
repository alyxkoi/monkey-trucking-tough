import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

interface CTASectionProps {
  headline: string;
  subtext: string;
  showContact?: boolean;
}

const CTASection = ({ headline, subtext, showContact = true }: CTASectionProps) => (
  <section className="bg-primary py-14 sm:py-16 lg:py-20">
    <div className="mx-auto max-w-[980px] px-5 text-center sm:px-8">
      <h2 className="font-heading text-[clamp(42px,6vw,72px)] uppercase leading-[0.94] text-white">{headline}</h2>
      <p className="mx-auto mt-4 max-w-2xl text-lg leading-relaxed text-white/90">{subtext}</p>
      <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
        <a href="sms:+12146778466" className="public-button bg-industrial text-white hover:bg-[#242428]"><MessageSquare className="h-5 w-5" />Text 214-677-8466</a>
        {showContact && <Link to="/contact" className="public-button border-2 border-white bg-white text-primary hover:bg-transparent hover:text-white">Get a Quote</Link>}
      </div>
    </div>
  </section>
);

export default CTASection;
