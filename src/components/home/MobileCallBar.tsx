import { Phone, MessageSquare } from "lucide-react";

const PHONE = "+12146778466";

const MobileCallBar = () => {
  return (
    <div
      className="md:hidden fixed inset-x-0 bottom-0 z-40 animate-slide-up-in"
      style={{
        paddingBottom: "calc(env(safe-area-inset-bottom, 0px) + 8px)",
        paddingLeft: 12,
        paddingRight: 12,
        paddingTop: 10,
        background: "linear-gradient(to top, rgba(14,14,16,0.96), rgba(14,14,16,0.82))",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderTop: "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="grid grid-cols-2 gap-2.5">
        <a
          href={`tel:${PHONE}`}
          className="flex items-center justify-center gap-2 h-12 min-h-[48px] rounded-md bg-primary text-primary-foreground font-heading tracking-wider text-base shadow-[0_8px_24px_rgba(255,59,59,0.35)] active:scale-[0.97] transition-transform"
          style={{ touchAction: "manipulation" }}
        >
          <Phone className="h-5 w-5" />
          CALL
        </a>
        <a
          href={`sms:${PHONE}`}
          className="flex items-center justify-center gap-2 h-12 min-h-[48px] rounded-md border border-white/25 bg-white/5 text-white font-heading tracking-wider text-base active:scale-[0.97] transition-transform"
          style={{ touchAction: "manipulation" }}
        >
          <MessageSquare className="h-5 w-5" />
          TEXT
        </a>
      </div>
    </div>
  );
};

export default MobileCallBar;
