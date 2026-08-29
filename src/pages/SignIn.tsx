import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";
import logo from "@/assets/monkey-trucking-logo.webp";


const SignIn = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (user) navigate("/admin", { replace: true });
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const { error: err } = await signIn(email.trim(), password);
    setBusy(false);
    if (err) {
      setError("Sign in failed. Check your email and password.");
      return;
    }
    navigate("/admin", { replace: true });
  };

  // Keep the focused field (and the button below it) above the keyboard.
  const keepVisible = (e: React.FocusEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    window.setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 250);
  };

  return (
    <div className="min-h-[100dvh] overflow-y-auto bg-[#0E0E10]">
      <Seo
        title="Team Sign In | Monkey Trucking LLC"
        description="Secure sign in for Monkey Trucking staff to reach the Control Center for tickets, jobs and invoicing."
        path="/signin"
        noindex
      />
      <button

        type="button"
        onClick={() => navigate("/")}
        aria-label="Back to homepage"
        className="fixed left-2 top-[max(8px,env(safe-area-inset-top))] z-10 flex h-12 w-12 items-center justify-center text-industrial-foreground/80 transition-colors hover:text-industrial-foreground"
      >
        <ChevronLeft size={28} />
      </button>

      <div className="mx-auto flex min-h-[100dvh] w-full max-w-sm flex-col px-6 pb-[max(48px,env(safe-area-inset-bottom))] pt-24">
        <img
          src={logo}
          alt="Monkey Trucking LLC"
          className="mx-auto h-20 w-auto object-contain"
        />
        <h1 className="mt-12 text-center font-heading text-h2 tracking-wider text-industrial-foreground">
          SIGN IN
        </h1>

        <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-6">
          <div className="flex flex-col gap-2">
            <label htmlFor="signin-email" className="text-xs uppercase tracking-widest text-gravel">
              Email
            </label>
            <Input
              id="signin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onFocus={keepVisible}
              onChange={(e) => setEmail(e.target.value)}
              className="h-14 rounded-none border-white/15 bg-black/40 text-base text-industrial-foreground"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="signin-password" className="text-xs uppercase tracking-widest text-gravel">
              Password
            </label>
            <Input
              id="signin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onFocus={keepVisible}
              onChange={(e) => setPassword(e.target.value)}
              className="h-14 rounded-none border-white/15 bg-black/40 text-base text-industrial-foreground"
            />
          </div>
          {error && <p className="text-sm text-primary">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="mt-2 h-14 min-h-[48px] rounded-none bg-primary font-heading text-h4 tracking-wider text-primary-foreground hover:bg-primary/85"
          >
            {busy ? "SIGNING IN…" : "SIGN IN"}
          </Button>
        </form>

        <div className="h-24 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
};

export default SignIn;
