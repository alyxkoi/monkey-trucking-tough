import { useState } from "react";
import { Link } from "react-router-dom";
import { User as UserIcon, Ticket, LogOut } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import LoginModal from "@/components/auth/LoginModal";
import { useAuth, initialsFor } from "@/hooks/useAuth";

const UserMenu = ({ className = "" }: { className?: string }) => {
  const { user, signOut } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);

  if (!user) {
    return (
      <>
        <button
          type="button"
          onClick={() => setLoginOpen(true)}
          aria-label="Sign in"
          className={`flex h-11 w-11 items-center justify-center rounded-full border border-white/15 text-industrial-foreground transition-colors hover:border-primary hover:text-primary ${className}`}
        >
          <UserIcon className="h-5 w-5" />
        </button>
        <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
      </>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-primary font-heading text-base tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5 ${className}`}
      >
        {initialsFor(user)}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-none border-white/10 bg-nearblack">
        <DropdownMenuItem asChild className="cursor-pointer text-industrial-foreground focus:bg-white/5 focus:text-primary">
          <Link to="/admin">
            <Ticket className="mr-2 h-4 w-4" />
            Tickets
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => signOut()}
          className="cursor-pointer text-industrial-foreground focus:bg-white/5 focus:text-primary"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default UserMenu;
