import { lazy, Suspense, useState } from "react";
import { User as UserIcon } from "lucide-react";
import { useAuth, initialsFor } from "@/hooks/useAuth";

const LoginModal = lazy(() => import("@/components/auth/LoginModal"));
const AuthenticatedUserMenu = lazy(() => import("@/components/auth/AuthenticatedUserMenu"));

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
        {loginOpen && (
          <Suspense fallback={null}>
            <LoginModal open={loginOpen} onOpenChange={setLoginOpen} />
          </Suspense>
        )}
      </>
    );
  }

  return (
    <Suspense
      fallback={(
        <span className={`flex h-11 w-11 items-center justify-center rounded-full bg-primary font-heading text-base tracking-wider text-primary-foreground ${className}`}>
          {initialsFor(user)}
        </span>
      )}
    >
      <AuthenticatedUserMenu initials={initialsFor(user)} onSignOut={signOut} className={className} />
    </Suspense>
  );
};

export default UserMenu;
