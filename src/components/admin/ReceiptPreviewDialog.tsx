import { useEffect, useState } from "react";
import { Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ReceiptPreviewDialogProps {
  blob: Blob | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPrint: () => void | Promise<void>;
  title?: string;
}

const ReceiptPreviewDialog = ({
  blob,
  open,
  onOpenChange,
  onPrint,
  title = "Receipt preview",
}: ReceiptPreviewDialogProps) => {
  const [imageUrl, setImageUrl] = useState("");

  useEffect(() => {
    if (!blob) {
      setImageUrl("");
      return;
    }
    const nextUrl = URL.createObjectURL(blob);
    setImageUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [blob]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="adm flex max-h-[calc(100dvh-48px)] w-[calc(100%-48px)] max-w-[548px] flex-col gap-3 overflow-hidden border-[var(--adm-line)] bg-[var(--adm-bg)] p-4 text-[var(--adm-text)] sm:rounded-[14px]">
        <DialogHeader>
          <DialogTitle className="adm-title text-left text-[24px]">{title}</DialogTitle>
          <DialogDescription className="text-left text-[var(--adm-text-2)]">
            Review the exact thermal image before printing.
          </DialogDescription>
        </DialogHeader>
        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[8px] bg-[var(--adm-raised)] p-3">
          {imageUrl && (
            <img
              src={imageUrl}
              alt="Black and white 4 by 6 thermal label preview"
              className="block h-auto max-h-[70dvh] w-auto max-w-full bg-white object-contain"
            />
          )}
        </div>
        <DialogFooter className="grid grid-cols-2 gap-3 space-x-0 sm:grid-cols-2 sm:space-x-0">
          <Button type="button" variant="outline" className="adm-btn" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" className="adm-btn adm-btn-red" onClick={() => void onPrint()} disabled={!blob}>
            <Printer size={20} /> Print
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ReceiptPreviewDialog;