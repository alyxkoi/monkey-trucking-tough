import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, Check, Loader2, Send } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTrackingAttribution } from "@/lib/trackingAttribution";

const SMS_DISCLOSURE_VERSION = "website-contact-v1-2026-08-27";

const EMPTY_FORM = {
  name: "",
  email: "",
  phone: "",
  projectType: "",
  location: "",
  message: "",
  smsConsent: false,
};

type QuoteRequestFormProps = {
  idPrefix?: string;
  appearance?: "dark" | "light";
};

export default function QuoteRequestForm({ idPrefix = "contact", appearance = "dark" }: QuoteRequestFormProps) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState<1 | 2>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);
  const hasChangedStep = useRef(false);
  const dark = appearance === "dark";
  const controlClass = dark ? "public-form-control public-form-control-dark" : "public-form-control";
  const labelClass = dark ? "public-form-label public-form-label-dark" : "public-form-label";

  useEffect(() => {
    if (hasChangedStep.current) stepHeadingRef.current?.focus({ preventScroll: true });
    hasChangedStep.current = true;
  }, [step]);

  const showProjectStep = () => {
    const fields = ["name", "phone", "email"]
      .map((field) => document.getElementById(`${idPrefix}-${field}`))
      .filter((field): field is HTMLInputElement => field instanceof HTMLInputElement);
    const invalidField = fields.find((field) => !field.checkValidity());
    if (invalidField) {
      invalidField.reportValidity();
      invalidField.focus();
      return;
    }
    setStep(2);
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (step === 1) {
      showProjectStep();
      return;
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke("send-contact-email", {
        body: {
          ...form,
          smsDisclosureVersion: SMS_DISCLOSURE_VERSION,
          trackingAttribution: getTrackingAttribution(),
        },
      });
      if (error) throw error;
      toast("Quote request sent.", { description: "Monkey Trucking will follow up with you." });
      setForm(EMPTY_FORM);
      setStep(1);
      setSubmitted(true);
    } catch (error) {
      console.error("Contact form error:", error);
      toast("Your request could not be sent.", { description: "Please call 214-677-8466." });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div role="status" className={`flex min-h-[420px] flex-col items-start justify-center p-6 sm:p-9 ${dark ? "text-white" : "text-[#171719]"}`}>
        <span className="flex h-14 w-14 items-center justify-center bg-primary text-white"><Check className="h-7 w-7" /></span>
        <h2 className="mt-6 font-heading text-[clamp(42px,6vw,64px)] uppercase leading-none">Request received</h2>
        <p className={`mt-3 text-lg ${dark ? "text-white/70" : "text-[#55555c]"}`}>We will get back to you shortly.</p>
        <button type="button" onClick={() => setSubmitted(false)} className={`public-text-link mt-6 ${dark ? "text-white hover:text-primary" : ""}`}>Send another request</button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit}>
      <div
        className="public-contact-progress"
        role="progressbar"
        aria-label="Quote request progress"
        aria-valuemin={1}
        aria-valuemax={2}
        aria-valuenow={step}
        aria-valuetext={`Step ${step} of 2`}
      >
        <span className="public-contact-progress-label">Step {step} of 2</span>
        <span className="public-contact-progress-track" aria-hidden="true">
          <span className="public-contact-progress-value" style={{ width: step === 1 ? "50%" : "100%" }} />
        </span>
      </div>

      {step === 1 ? (
        <div className="public-contact-step" key="contact-details">
          <div className="public-contact-step-heading">
            <h3 ref={stepHeadingRef} id={`${idPrefix}-step-1-heading`} tabIndex={-1}>Your contact details</h3>
            <p>Start with the best way for us to reach you.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${idPrefix}-name`} className={labelClass}>Name</label>
              <Input id={`${idPrefix}-name`} autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className={controlClass} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-phone`} className={labelClass}>Phone</label>
              <Input id={`${idPrefix}-phone`} type="tel" inputMode="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required className={controlClass} />
            </div>
            <div>
              <label htmlFor={`${idPrefix}-email`} className={labelClass}>Email</label>
              <Input id={`${idPrefix}-email`} type="email" inputMode="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required className={controlClass} />
            </div>
          </div>
          <Button type="button" onClick={showProjectStep} className="public-contact-submit mt-6 w-full">
            <span className="public-contact-submit-content">Continue to project details<ArrowRight /></span>
          </Button>
        </div>
      ) : (
        <div className="public-contact-step" key="project-details">
          <div className="public-contact-step-heading">
            <h3 ref={stepHeadingRef} id={`${idPrefix}-step-2-heading`} tabIndex={-1}>Project details</h3>
            <p>Tell us what you need and where the work is located.</p>
          </div>
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label htmlFor={`${idPrefix}-project-type`} className={labelClass}>What do you need?</label>
              <Select value={form.projectType} onValueChange={(value) => setForm({ ...form, projectType: value })}>
                <SelectTrigger id={`${idPrefix}-project-type`} className={controlClass}><SelectValue placeholder="Choose one" /></SelectTrigger>
                <SelectContent className={dark ? "public-contact-select-content" : undefined}>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="material-delivery">Material Delivery</SelectItem>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="gravel-driveway">Driveway or Private Road</SelectItem>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="pond-work">Pond Work</SelectItem>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="dirt-work">Dirt Work or Grading</SelectItem>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="light-land-clearing">Light Land Clearing</SelectItem>
                  <SelectItem className={dark ? "public-contact-select-item" : undefined} value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${idPrefix}-location`} className={labelClass}>Service or delivery location</label>
              <Input id={`${idPrefix}-location`} autoComplete="street-address" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Address, city or nearest cross street" className={controlClass} />
            </div>
            <div className="sm:col-span-2">
              <label htmlFor={`${idPrefix}-message`} className={labelClass}>Details</label>
              <Textarea id={`${idPrefix}-message`} value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={4} placeholder="Material, amount, job details or anything else we should know" className={`${controlClass} min-h-[132px]`} />
            </div>

            <div className={`p-4 sm:col-span-2 ${dark ? "public-contact-consent" : "border border-black/10 bg-[#f3f2f0]"}`}>
              <div className="flex items-start gap-3">
                <Checkbox id={`${idPrefix}-sms-consent`} checked={form.smsConsent} onCheckedChange={(checked) => setForm({ ...form, smsConsent: checked === true })} aria-describedby={`${idPrefix}-sms-disclosure`} className={`mt-1 h-5 w-5 ${dark ? "border-white/40 data-[state=checked]:border-primary data-[state=checked]:bg-primary" : ""}`} />
                <div id={`${idPrefix}-sms-disclosure`} className={`text-sm leading-relaxed ${dark ? "text-white/[0.68]" : "text-muted-foreground"}`}>
                  <label htmlFor={`${idPrefix}-sms-consent`} className="cursor-pointer">
                    I agree to receive customer care text messages from Monkey Trucking LLC regarding quotes, scheduling, deliveries, job updates, and service questions. Message frequency varies. Msg &amp; data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase. See our{" "}
                  </label>
                  <Link to="/privacy-policy" className="font-medium text-primary underline underline-offset-2">Privacy Policy</Link>{" "}and{" "}
                  <Link to="/terms" className="font-medium text-primary underline underline-offset-2">Terms &amp; Conditions</Link>.
                  <p className={`mt-2 text-xs ${dark ? "text-white/[0.52]" : "text-muted-foreground"}`}>Optional. Leave unchecked to submit without SMS consent.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="public-contact-actions">
            <Button type="button" onClick={() => setStep(1)} className="public-contact-back"><ArrowLeft />Back</Button>
            <Button type="submit" disabled={isSubmitting} className="public-contact-submit">
              <span className="public-contact-submit-content">
                {isSubmitting ? <><Loader2 className="h-5 w-5 animate-spin" />Sending...</> : <><Send className="h-5 w-5" />Send Quote Request</>}
              </span>
            </Button>
          </div>
        </div>
      )}
    </form>
  );
}
