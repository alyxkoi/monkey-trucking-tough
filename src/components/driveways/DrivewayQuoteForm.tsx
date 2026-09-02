import { useRef, useState, type FormEvent } from "react";
import { Check, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { getTrackingAttribution } from "@/lib/trackingAttribution";

const SMS_DISCLOSURE_VERSION = "website-contact-v1-2026-08-27";

const EMPTY_FORM = { name: "", phone: "", location: "" };

type FieldName = keyof typeof EMPTY_FORM;
type FieldErrors = Partial<Record<FieldName, string>>;

type DrivewayQuoteFormProps = {
  onInteractionChange?: (active: boolean) => void;
};

const newClientRequestId = () => globalThis.crypto?.randomUUID?.()
  ?? "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (digit) => (
    Number(digit) ^ (Math.random() * 16 >> Number(digit) / 4)
  ).toString(16));

function validate(form: typeof EMPTY_FORM): FieldErrors {
  const errors: FieldErrors = {};
  if (form.name.trim().length < 2) errors.name = "Enter your name.";
  if (form.phone.replace(/\D/g, "").length < 10) errors.phone = "Enter a 10-digit phone number.";
  if (form.location.trim().length < 2) errors.location = "Enter your city or ZIP.";
  return errors;
}

export default function DrivewayQuoteForm({ onInteractionChange }: DrivewayQuoteFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  const clientRequestId = useRef(newClientRequestId());

  const update = (field: FieldName, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSubmitError("");
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validate(form);
    setErrors(nextErrors);
    const firstInvalid = (Object.keys(nextErrors) as FieldName[])[0];
    if (firstInvalid) {
      requestAnimationFrame(() => document.getElementById(`driveway-${firstInvalid}`)?.focus());
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: "",
        location: form.location.trim(),
        projectType: "gravel-driveway",
        message: "Driveway campaign quote request.",
        smsConsent: false,
        smsDisclosureVersion: SMS_DISCLOSURE_VERSION,
        trackingAttribution: getTrackingAttribution(),
        clientRequestId: clientRequestId.current,
      };
      const { error } = await supabase.functions.invoke("send-contact-email", { body });
      if (error) throw error;
      setSubmitted(true);
      setForm(EMPTY_FORM);
      clientRequestId.current = newClientRequestId();
      onInteractionChange?.(false);
    } catch (error) {
      console.error("Driveway quote form error:", error);
      setSubmitError("We could not send your request. Please call or text 214-677-8466.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="driveway-form-success" role="status" aria-live="polite">
        <span className="driveway-form-success-icon"><Check aria-hidden="true" /></span>
        <p className="driveway-form-kicker">REQUEST RECEIVED</p>
        <h2>We have your driveway details.</h2>
        <p>Monkey Trucking will follow up using the phone number you provided.</p>
        <button type="button" onClick={() => setSubmitted(false)}>Send another request</button>
      </div>
    );
  }

  return (
    <form
      ref={formRef}
      id="driveway-quote"
      className="driveway-quote-form"
      onSubmit={handleSubmit}
      onFocus={() => onInteractionChange?.(true)}
      onBlur={(event) => {
        if (!formRef.current?.contains(event.relatedTarget as Node | null)) onInteractionChange?.(false);
      }}
      noValidate
    >
      <div className="driveway-form-heading">
        <p className="driveway-form-kicker">GET A FREE QUOTE</p>
        <h2>Tell us where the driveway is.</h2>
        <p>Takes about 30 seconds.</p>
      </div>

      <div className="driveway-form-fields">
        <div>
          <label htmlFor="driveway-name">Name</label>
          <input
            id="driveway-name"
            name="name"
            autoComplete="name"
            value={form.name}
            onChange={(event) => update("name", event.target.value)}
            aria-invalid={Boolean(errors.name)}
            aria-describedby={errors.name ? "driveway-name-error" : undefined}
          />
          {errors.name && <p id="driveway-name-error" className="driveway-field-error">{errors.name}</p>}
        </div>
        <div>
          <label htmlFor="driveway-phone">Phone</label>
          <input
            id="driveway-phone"
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={form.phone}
            onChange={(event) => update("phone", event.target.value)}
            aria-invalid={Boolean(errors.phone)}
            aria-describedby={errors.phone ? "driveway-phone-error" : undefined}
          />
          {errors.phone && <p id="driveway-phone-error" className="driveway-field-error">{errors.phone}</p>}
        </div>
        <div>
          <label htmlFor="driveway-location">City or ZIP</label>
          <input
            id="driveway-location"
            name="location"
            autoComplete="postal-code"
            value={form.location}
            onChange={(event) => update("location", event.target.value)}
            aria-invalid={Boolean(errors.location)}
            aria-describedby={errors.location ? "driveway-location-error" : undefined}
          />
          {errors.location && <p id="driveway-location-error" className="driveway-field-error">{errors.location}</p>}
        </div>
      </div>

      {submitError && <p className="driveway-submit-error" role="alert">{submitError}</p>}

      <button className="driveway-primary-button driveway-form-submit" type="submit" disabled={isSubmitting}>
        {isSubmitting ? <><Loader2 className="driveway-spinner" aria-hidden="true" /> Sending request</> : "Get a free quote"}
      </button>
      <p className="driveway-form-privacy">
        Your information is used only to respond to this request. See our <Link to="/privacy-policy">Privacy Policy</Link>.
      </p>
    </form>
  );
}
