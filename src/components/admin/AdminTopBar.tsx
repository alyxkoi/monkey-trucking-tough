import { ChevronLeft } from "lucide-react";
import SignOutButton from "@/components/admin/SignOutButton";

type AdminTopBarProps = {
  title: string;
  onBack: () => void;
};

const AdminTopBar = ({ title, onBack }: AdminTopBarProps) => (
  <header className="adm-topbar">
    <button type="button" className="adm-topbar-back" onClick={onBack} aria-label="Back to dashboard">
      <ChevronLeft size={26} />
    </button>
    <span>{title}</span>
    <SignOutButton className="justify-self-end pr-1" />
  </header>
);

export default AdminTopBar;
