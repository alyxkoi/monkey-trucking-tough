import { Phone, MessageSquare } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { type ReactNode, useState } from "react";

const PHONE = "+12146778466"; // phone number

interface ContactActionSheetProps {
  children: (props: { onClick: () => void }) => ReactNode;
}

export default function ContactActionSheet({ children }: ContactActionSheetProps) {
  const [open, setOpen] = useState(false);
  const isMobile = useIsMobile();

  const handleClick = () => {
    if (isMobile) {
      setOpen(true);
    } else {
      window.location.href = `tel:${PHONE}`;
    }
  };

  return (
    <>
      {children({ onClick: handleClick })}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-sm mx-auto bg-industrial border-gravel/20">
          <DialogTitle className="font-heading text-h3 text-primary text-center">
            Get in Touch
          </DialogTitle>
          <div className="flex flex-col gap-3 pt-2">
            <a href={`tel:${PHONE}`} onClick={() => setOpen(false)}>
              <Button className="w-full bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider h-14 min-h-[48px]">
                <Phone className="mr-3 h-5 w-5" />
                CALL (214) 677-8466
              </Button>
            </a>
            <a href={`sms:${PHONE}`} onClick={() => setOpen(false)}>
              <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary/10 font-heading text-h4 tracking-wider h-14 min-h-[48px]">
                <MessageSquare className="mr-3 h-5 w-5" />
                TEXT (214) 677-8466
              </Button>
            </a>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
