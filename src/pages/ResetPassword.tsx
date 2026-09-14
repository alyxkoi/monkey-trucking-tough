import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";
import logo from "@/assets/monkey-trucking-logo.webp";
import "@/styles/signin.css";

const ResetPassword = () => {
  const { user, loading, isPasswordRecovery, updatePassword, signOut } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [complete, setComplete] = useState(false);
  const recoveryLinkPresent = useMemo(() => {
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    return hash.get("type") === "recovery" || query.has("code");
  }, []);
  const canReset = Boolean(user) && (isPasswordRecovery || recoveryLinkPresent);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (busy) return;
    if (password.length < 8) {
      setError("Use at least 8 characters for your new password.");
      return;
    }
    if (password !== confirmation) {
      setError("The passwords don't match.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = await updatePassword(password);
      if (result.error) {
        setError(/expired|session|token/i.test(result.error)
          ? "This reset link has expired. Request a new one and try again."
          : "We couldn't update your password. Please try again.");
        return;
      }
      setComplete(true);
      await signOut();
    } finally {
      setBusy(false);
    }
  };

  const clearError = () => {
    if (error) setError(null);
  };

  return (
    <div className="signin-page">
      <Seo
        title="Choose New Password | Monkey Trucking LLC"
        description="Choose a new password for the Monkey Trucking Control Center."
        path="/reset-password"
        noindex
      />
      <div className="signin-page__grid" aria-hidden="true" />
      <button type="button" onClick={() => navigate("/signin")} aria-label="Back to sign in" className="signin-back">
        <ArrowLeft aria-hidden="true" />
      </button>

      <main className="signin-shell">
        <section className="signin-card" aria-labelledby="reset-password-title">
          <div className="signin-card__edge" aria-hidden="true" />
          <header className="signin-heading signin-reveal signin-reveal--first">
            <img src={logo} alt="Monkey Trucking LLC" className="signin-logo" />
            <p className="signin-eyebrow">Secure Reset</p>
            <h1 id="reset-password-title" className="signin-title">NEW PASSWORD.</h1>
            <p className="signin-subtitle">Choose a strong password you haven't used here before.</p>
          </header>

          {complete ? (
            <div className="signin-state signin-reveal signin-reveal--second" aria-live="polite">
              <div className="signin-notice signin-notice--success" role="status">
                <CircleCheck aria-hidden="true" />
                <div>
                  <strong>Password updated</strong>
                  <span>Your new password is ready. Sign in to continue.</span>
                </div>
              </div>
              <Button asChild className="signin-submit">
                <Link to="/signin">SIGN IN</Link>
              </Button>
            </div>
          ) : loading ? (
            <div className="signin-state signin-state--center" role="status" aria-live="polite">
              <LoaderCircle aria-hidden="true" className="signin-spinner" />
              <span>Verifying your secure link…</span>
            </div>
          ) : !canReset ? (
            <div className="signin-state signin-reveal signin-reveal--second">
              <div className="signin-notice" role="alert">
                <CircleAlert aria-hidden="true" />
                <div>
                  <strong>This link isn't valid anymore</strong>
                  <span>Reset links can only be used once and expire for your protection.</span>
                </div>
              </div>
              <Button asChild className="signin-submit">
                <Link to="/forgot-password">REQUEST A NEW LINK</Link>
              </Button>
              <Link to="/signin" className="signin-secondary-action">Back to sign in</Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="signin-form signin-reveal signin-reveal--second" aria-busy={busy}>
              <div className="signin-field">
                <label htmlFor="new-password" className="signin-label">New password</label>
                <div className="signin-password">
                  <Input
                    id="new-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    required
                    autoFocus
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      clearError();
                    }}
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "reset-error" : "password-hint"}
                    className="signin-input signin-input--password"
                  />
                  <button
                    type="button"
                    className="signin-password__toggle"
                    aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                    aria-pressed={showPassword}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => setShowPassword((visible) => !visible)}
                  >
                    {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                  </button>
                </div>
                <p id="password-hint" className="signin-field-hint">At least 8 characters.</p>
              </div>

              <div className="signin-field">
                <label htmlFor="confirm-password" className="signin-label">Confirm password</label>
                <Input
                  id="confirm-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="new-password"
                  minLength={8}
                  required
                  value={confirmation}
                  onChange={(event) => {
                    setConfirmation(event.target.value);
                    clearError();
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "reset-error" : undefined}
                  className="signin-input"
                />
              </div>

              <div className="signin-feedback" aria-live="polite">
                {error && (
                  <p id="reset-error" role="alert" className="signin-error">
                    <CircleAlert aria-hidden="true" />
                    <span>{error}</span>
                  </p>
                )}
              </div>

              <Button type="submit" disabled={busy} className="signin-submit">
                {busy && <LoaderCircle aria-hidden="true" className="signin-spinner" />}
                <span>{busy ? "UPDATING…" : "UPDATE PASSWORD"}</span>
              </Button>
            </form>
          )}
        </section>
      </main>
    </div>
  );
};

export default ResetPassword;
