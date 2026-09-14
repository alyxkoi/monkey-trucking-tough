import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert, CircleCheck, LoaderCircle, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";
import logo from "@/assets/monkey-trucking-logo.webp";
import "@/styles/signin.css";

const ForgotPassword = () => {
  const { requestPasswordReset } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const redirectTo = `${window.location.origin}/reset-password`;
      const result = await requestPasswordReset(email.trim(), redirectTo);
      if (result.error) {
        setError("We couldn't send the reset email right now. Please wait a moment and try again.");
        return;
      }
      setSent(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin-page">
      <Seo
        title="Reset Password | Monkey Trucking LLC"
        description="Request a secure password reset for the Monkey Trucking Control Center."
        path="/forgot-password"
        noindex
      />
      <div className="signin-page__grid" aria-hidden="true" />
      <button type="button" onClick={() => navigate("/signin")} aria-label="Back to sign in" className="signin-back">
        <ArrowLeft aria-hidden="true" />
      </button>

      <main className="signin-shell">
        <section className="signin-card" aria-labelledby="forgot-password-title">
          <div className="signin-card__edge" aria-hidden="true" />
          <header className="signin-heading signin-reveal signin-reveal--first">
            <img src={logo} alt="Monkey Trucking LLC" className="signin-logo" />
            <p className="signin-eyebrow">Account Recovery</p>
            <h1 id="forgot-password-title" className="signin-title">RESET ACCESS.</h1>
            <p className="signin-subtitle">Enter your team email and we'll send a secure reset link.</p>
          </header>

          {sent ? (
            <div className="signin-state signin-reveal signin-reveal--second" aria-live="polite">
              <div className="signin-notice signin-notice--success" role="status">
                <CircleCheck aria-hidden="true" />
                <div>
                  <strong>Check your inbox</strong>
                  <span>If an account exists for {email.trim()}, a reset link is on its way.</span>
                </div>
              </div>
              <p className="signin-help">For security, the link expires. Check spam if it doesn't arrive within a few minutes.</p>
              <Button asChild className="signin-submit">
                <Link to="/signin">BACK TO SIGN IN</Link>
              </Button>
              <button type="button" className="signin-secondary-action" onClick={() => setSent(false)}>
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="signin-form signin-reveal signin-reveal--second" aria-busy={busy}>
              <div className="signin-field">
                <label htmlFor="recovery-email" className="signin-label">Email</label>
                <div className="signin-icon-input">
                  <Mail aria-hidden="true" />
                  <Input
                    id="recovery-email"
                    type="email"
                    inputMode="email"
                    autoCapitalize="none"
                    autoComplete="email"
                    spellCheck={false}
                    required
                    autoFocus
                    value={email}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      if (error) setError(null);
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "recovery-error" : "recovery-hint"}
                    className="signin-input signin-input--icon"
                  />
                </div>
                <p id="recovery-hint" className="signin-field-hint">Use the email attached to your dashboard account.</p>
              </div>

              <div className="signin-feedback" aria-live="polite">
                {error && (
                  <p id="recovery-error" role="alert" className="signin-error">
                    <CircleAlert aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={busy} className="signin-submit">
                {busy && <LoaderCircle aria-hidden="true" className="signin-spinner" />}
                <span>{busy ? "SENDING LINK…" : "SEND RESET LINK"}</span>
              </Button>
              <Link to="/signin" className="signin-secondary-action">Back to sign in</Link>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default ForgotPassword;
