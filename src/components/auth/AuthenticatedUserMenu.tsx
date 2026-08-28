import { LayoutDashboard, LogOut } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type AuthenticatedUserMenuProps = {
  initials: string;
  onSignOut: () => Promise<void>;
  className?: string;
};

export default function AuthenticatedUserMenu({ initials, onSignOut, className = "" }: AuthenticatedUserMenuProps) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Account menu"
        className={`flex h-11 w-11 items-center justify-center rounded-full bg-primary font-heading text-base tracking-wider text-primary-foreground transition-transform hover:-translate-y-0.5 ${className}`}
      >
        {initials}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-40 rounded-none border-white/10 bg-nearblack">
        <DropdownMenuItem asChild className="cursor-pointer text-industrial-foreground focus:bg-white/5 focus:text-primary">
          <Link to="/admin">
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => void onSignOut()}
          className="cursor-pointer text-industrial-foreground focus:bg-white/5 focus:text-primary"
        >
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
