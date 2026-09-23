import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CircleAlert, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import Seo from "@/components/Seo";
import logo from "@/assets/monkey-trucking-logo.webp";
import "@/styles/signin.css";

const SignIn = () => {
  const { signIn, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const alertReturn = typeof location.state?.from === 'string' && /^\/admin\/alerts\/[A-Z0-9]{10}$/i.test(location.state.from) ? location.state.from : '/admin';
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const redirecting = useRef(false);
  const passwordInput = useRef<HTMLInputElement>(null);

  const goToControlCenter = useCallback(() => {
    if (redirecting.current) return;
    redirecting.current = true;
    navigate(alertReturn, { replace: true });
  }, [navigate, alertReturn]);

  useEffect(() => {
    if (user) goToControlCenter();
  }, [user, goToControlCenter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;

    setBusy(true);
    setError(null);
    try {
      const { error: err } = await signIn(email.trim(), password);
      if (err) {
        const offline = !navigator.onLine || /network|fetch|reach/i.test(err);
        setError(offline
          ? "We couldn't reach the sign-in service. Check your connection and try again."
          : "That email or password is incorrect.");
        passwordInput.current?.focus({ preventScroll: true });
        return;
      }
      goToControlCenter();
    } catch {
      setError("We couldn't reach the sign-in service. Check your connection and try again.");
      passwordInput.current?.focus({ preventScroll: true });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="signin-page">
      <Seo
        title="Team Sign In | Monkey Trucking LLC"
        description="Secure sign in for Monkey Trucking staff to reach the Control Center for tickets, jobs and invoicing."
        path="/signin"
        noindex
      />

      <div className="signin-page__grid" aria-hidden="true" />

      <button
        type="button"
        onClick={() => navigate("/")}
        aria-label="Back to homepage"
        className="signin-back"
      >
        <ArrowLeft aria-hidden="true" />
      </button>

      <main className="signin-shell">
        <section className="signin-card" aria-labelledby="signin-title">
          <div className="signin-card__edge" aria-hidden="true" />

          <header className="signin-heading signin-reveal signin-reveal--first">
            <img src={logo} alt="Monkey Trucking LLC" className="signin-logo" />
            <p className="signin-eyebrow">Control Center Access</p>
            <h1 id="signin-title" className="signin-title">WELCOME BACK.</h1>
            <p className="signin-subtitle">Sign in to Monkey Trucking.</p>
          </header>

          <form
            onSubmit={handleSubmit}
            className="signin-form signin-reveal signin-reveal--second"
            aria-busy={busy}
          >
            <div className="signin-field">
              <label htmlFor="signin-email" className="signin-label">Email</label>
              <Input
                id="signin-email"
                type="email"
                inputMode="email"
                autoCapitalize="none"
                autoComplete="username"
                spellCheck={false}
                required
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError(null);
                }}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "signin-error" : undefined}
                className="signin-input"
              />
            </div>

            <div className="signin-field">
              <div className="signin-field__heading">
                <label htmlFor="signin-password" className="signin-label">Password</label>
                <Link to="/forgot-password" className="signin-text-link">Forgot password?</Link>
              </div>
              <div className="signin-password">
                <Input
                  ref={passwordInput}
                  id="signin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (error) setError(null);
                  }}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "signin-error" : undefined}
                  className="signin-input signin-input--password"
                />
                <button
                  type="button"
                  className="signin-password__toggle"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => setShowPassword((visible) => !visible)}
                >
                  {showPassword ? <EyeOff aria-hidden="true" /> : <Eye aria-hidden="true" />}
                </button>
              </div>
            </div>

            <div className="signin-feedback" aria-live="polite">
              {error && (
                <p id="signin-error" role="alert" className="signin-error">
                  <CircleAlert aria-hidden="true" />
                  <span>{error}</span>
                </p>
              )}
            </div>

            <Button type="submit" disabled={busy} className="signin-submit">
              {busy && <LoaderCircle aria-hidden="true" className="signin-spinner" />}
              <span>{busy ? "SIGNING IN…" : "SIGN IN"}</span>
            </Button>
          </form>
        </section>
      </main>
    </div>
  );
};

export default SignIn;
