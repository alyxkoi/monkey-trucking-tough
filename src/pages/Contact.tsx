import { useState } from "react";
import { Link } from "react-router-dom";
import { Loader2, MapPin, Phone, Send } from "lucide-react";
import Seo from "@/components/Seo";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import { getTrackingAttribution } from "@/lib/trackingAttribution";
import contactHeroImg from "@/assets/contact-hero.webp";

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

const Contact = () => {
  const [form, setForm] = useState(EMPTY_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
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
    } catch (error) {
      console.error("Contact form error:", error);
      toast("Your request could not be sent.", { description: "Please call 214-677-8466." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Seo
        title="Request a Gravel, Driveway or Dirt Work Quote | Kaufman TX"
        description="Call Monkey Trucking or request a quote for material delivery, driveway work, pond work, grading, hauling or light land clearing near Kaufman, TX."
        path="/contact"
      />

      <section className="public-page-hero min-h-[410px]">
        <img src={contactHeroImg} alt="Monkey Trucking dump truck ready for material delivery" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-nearblack via-nearblack/76 to-nearblack/20" />
        <div className="relative mx-auto w-full max-w-[1380px] px-5 sm:px-8 lg:px-12">
          <div className="max-w-[760px]">
            <h1 className="public-page-title">Tell us what you need</h1>
            <p className="public-page-intro">Call now or send the project, material and location below.</p>
            <a href="tel:+12146778466" className="public-button public-button-primary mt-7"><Phone className="h-5 w-5" />Call 214-677-8466</a>
          </div>
        </div>
      </section>

      <section className="bg-[#efeeec] py-12 sm:py-16 lg:py-20">
        <div className="mx-auto grid max-w-[1180px] grid-cols-1 gap-8 px-5 sm:px-8 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)] lg:gap-12">
          <div className="rounded-lg border border-black/10 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="font-heading text-[clamp(36px,5vw,54px)] uppercase leading-none text-foreground">Get a quote</h2>
            <form onSubmit={handleSubmit} className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2">
              <div>
                <label htmlFor="contact-name" className="public-form-label">Name</label>
                <Input id="contact-name" autoComplete="name" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required className="public-form-control" />
              </div>
              <div>
                <label htmlFor="contact-phone" className="public-form-label">Phone</label>
                <Input id="contact-phone" type="tel" autoComplete="tel" value={form.phone} onChange={(event) => setForm({ ...form, phone: event.target.value })} required className="public-form-control" />
              </div>
              <div>
                <label htmlFor="contact-email" className="public-form-label">Email</label>
                <Input id="contact-email" type="email" autoComplete="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required className="public-form-control" />
              </div>
              <div>
                <label htmlFor="contact-project-type" className="public-form-label">What do you need?</label>
                <Select value={form.projectType} onValueChange={(value) => setForm({ ...form, projectType: value })}>
                  <SelectTrigger id="contact-project-type" className="public-form-control"><SelectValue placeholder="Choose one" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="material-delivery">Material Delivery</SelectItem>
                    <SelectItem value="gravel-driveway">Driveway or Private Road</SelectItem>
                    <SelectItem value="pond-work">Pond Work</SelectItem>
                    <SelectItem value="dirt-work">Dirt Work or Grading</SelectItem>
                    <SelectItem value="light-land-clearing">Light Land Clearing</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="contact-location" className="public-form-label">Service or delivery location</label>
                <Input id="contact-location" autoComplete="street-address" value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Address, city or nearest cross street" className="public-form-control" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="contact-message" className="public-form-label">Details</label>
                <Textarea id="contact-message" value={form.message} onChange={(event) => setForm({ ...form, message: event.target.value })} rows={4} placeholder="Material, amount, job details or anything else we should know" className="min-h-[132px] text-base" />
              </div>

              <div className="rounded-lg border border-black/10 bg-[#f3f2f0] p-4 sm:col-span-2">
                <div className="flex items-start gap-3">
                  <Checkbox
                    id="contact-sms-consent"
                    checked={form.smsConsent}
                    onCheckedChange={(checked) => setForm({ ...form, smsConsent: checked === true })}
                    aria-describedby="contact-sms-disclosure"
                    className="mt-1 h-5 w-5"
                  />
                  <div id="contact-sms-disclosure" className="text-sm leading-relaxed text-muted-foreground">
                    <label htmlFor="contact-sms-consent" className="cursor-pointer">
                      I agree to receive customer care text messages from Monkey Trucking LLC regarding quotes, scheduling, deliveries, job updates, and service questions. Message frequency varies. Msg &amp; data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase. See our{" "}
                    </label>
                    <Link to="/privacy-policy" className="font-medium text-primary underline underline-offset-2">Privacy Policy</Link>{" "}and{" "}
                    <Link to="/terms" className="font-medium text-primary underline underline-offset-2">Terms &amp; Conditions</Link>.
                    <p className="mt-2 text-xs text-muted-foreground">Optional. Leave unchecked to submit without SMS consent.</p>
                  </div>
                </div>
              </div>

              <Button type="submit" disabled={isSubmitting} className="h-14 bg-primary px-7 font-heading text-xl tracking-wider text-white hover:bg-primary/85 disabled:opacity-70 sm:col-span-2">
                {isSubmitting ? <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Sending...</> : <><Send className="mr-2 h-5 w-5" />Send Quote Request</>}
              </Button>
            </form>
          </div>

          <aside className="space-y-4 lg:pt-2">
            <a href="tel:+12146778466" className="block rounded-lg bg-primary p-6 text-white transition-transform hover:-translate-y-0.5 motion-reduce:transition-none">
              <Phone className="h-7 w-7" />
              <p className="mt-5 font-heading text-3xl uppercase">Call now</p>
              <p className="mt-1 text-xl font-semibold">214-677-8466</p>
            </a>
            <div className="rounded-lg bg-industrial p-6 text-white">
              <MapPin className="h-7 w-7 text-primary" />
              <h2 className="mt-5 font-heading text-3xl uppercase">Kaufman, Texas</h2>
              <p className="mt-2 text-base leading-relaxed text-white/70">7653 S FM 148<br />Kaufman, TX 75142</p>
              <p className="mt-5 border-t border-white/10 pt-5 text-base leading-relaxed text-white/70">Serving Kaufman County and surrounding DFW areas. Call with your location to confirm service.</p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
};

export default Contact;
