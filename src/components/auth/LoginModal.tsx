import { useState } from "react";
import { useNavigate } from "react-router-dom";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
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
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="public-login-backdrop" />
        <DialogPrimitive.Content
          className="public-login-modal"
          aria-describedby={undefined}
        >
          <div className="public-login-heading">
            <DialogPrimitive.Title className="public-login-title">
              SIGN IN
            </DialogPrimitive.Title>
            <span className="public-login-accent" aria-hidden="true" />
          </div>

          <form onSubmit={handleSubmit} className="public-login-form">
            <div className="public-login-field">
              <label htmlFor="admin-email" className="public-login-label">
                Email
              </label>
              <Input
                id="admin-email"
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="public-login-input"
              />
            </div>
            <div className="public-login-field">
              <label htmlFor="admin-password" className="public-login-label">
                Password
              </label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="public-login-input"
              />
            </div>
            {error && <p role="alert" className="public-login-error">{error}</p>}
            <Button
              type="submit"
              disabled={busy}
              className="public-login-submit"
            >
              {busy ? "SIGNING IN…" : "SIGN IN"}
            </Button>
          </form>

          <DialogPrimitive.Close className="public-login-close" aria-label="Close sign in">
            <X aria-hidden="true" />
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default LoginModal;
