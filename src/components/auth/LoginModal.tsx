import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";

interface LoginModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const LoginModal = ({ open, onOpenChange }: LoginModalProps) => {
  const { signIn } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
    setEmail("");
    setPassword("");
    onOpenChange(false);
    navigate("/admin");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm bg-nearblack border border-white/10 rounded-none">
        <DialogTitle className="font-heading text-h3 tracking-wider text-industrial-foreground">
          Sign in
        </DialogTitle>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3 pt-1">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-email" className="text-xs uppercase tracking-widest text-gravel">
              Email
            </label>
            <Input
              id="admin-email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-12 rounded-none bg-black/40 border-white/15 text-industrial-foreground"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="admin-password" className="text-xs uppercase tracking-widest text-gravel">
              Password
            </label>
            <Input
              id="admin-password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-12 rounded-none bg-black/40 border-white/15 text-industrial-foreground"
            />
          </div>
          {error && <p className="text-sm text-primary">{error}</p>}
          <Button
            type="submit"
            disabled={busy}
            className="mt-1 h-12 min-h-[48px] rounded-none bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider"
          >
            {busy ? "SIGNING IN…" : "SIGN IN"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default LoginModal;
