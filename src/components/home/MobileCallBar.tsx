import { MessageSquare } from "lucide-react";
import { Link } from "react-router-dom";

const MobileCallBar = () => (
  <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-nearblack/95 px-3 pb-[max(8px,env(safe-area-inset-bottom))] pt-2.5 backdrop-blur-md md:hidden">
    <div className="grid grid-cols-2 gap-2.5">
      <a href="sms:+12146778466" className="flex min-h-12 items-center justify-center gap-2 rounded-md bg-primary px-3 font-heading text-lg tracking-wider text-white active:scale-[0.98]">
        <MessageSquare className="h-5 w-5" />Text
      </a>
      <Link to="/contact" className="flex min-h-12 items-center justify-center rounded-md border border-white/25 bg-white/5 px-3 font-heading text-lg tracking-wider text-white active:scale-[0.98]">
        Get Quote
      </Link>
    </div>
  </div>
);

export default MobileCallBar;
