import { useState } from "react";
import Seo from "@/components/Seo";
import { Phone, MapPin, Send, Loader2 } from "lucide-react";
import contactHeroImg from "@/assets/contact-hero.webp";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/components/ui/sonner";
import { supabase } from "@/integrations/supabase/client";
import CTASection from "@/components/CTASection";
import ContactActionSheet from "@/components/ContactActionSheet";

const Contact = () => {
  const [form, setForm] = useState({ name: "", email: "", phone: "", projectType: "", message: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-contact-email", {
        body: form,
      });
      if (error) throw error;
      toast("Message sent! We'll get back to you soon.", { description: "Thank you for contacting Monkey Trucking." });
      setForm({ name: "", email: "", phone: "", projectType: "", message: "" });
    } catch (err) {
      console.error("Contact form error:", err);
      toast("Something went wrong. Please call us instead.", { description: "We apologize for the inconvenience." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <Seo
        title="Gravel Delivery & Driveway Quotes Near Me | Kaufman TX"
        description="Call or text for gravel delivery, gravel driveway installation, pond construction, or excavation quotes near Kaufman, TX. Fast response, fair pricing."
        path="/contact"
      />
      {/* Hero */}
      <section className="relative bg-industrial py-20 md:py-28 overflow-hidden">
        <img src={contactHeroImg} alt="" className="absolute inset-0 w-full h-full object-cover blur-sm scale-105 opacity-30" />
        <div className="relative container mx-auto px-4">
          <h1 className="font-heading text-h1 text-white mb-4">CONTACT MONKEY TRUCKING</h1>
          <p className="text-body text-white/80 max-w-2xl">
            Ready to get a quote? Call, text, or fill out the form below. We respond fast and provide honest, fair pricing.
          </p>
        </div>
      </section>

      {/* Contact Form + Info */}
      <section className="py-16 md:py-20 bg-background">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* Form */}
            <div>
              <h2 className="font-heading text-h3 text-foreground mb-6">SEND US A MESSAGE</h2>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="contact-name" className="text-body font-medium text-foreground block mb-2">Name</label>
                  <Input
                    id="contact-name"
                    placeholder="Your name"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    required
                    className="h-12 text-body"
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className="text-body font-medium text-foreground block mb-2">Email</label>
                  <Input
                    id="contact-email"
                    type="email"
                    placeholder="Your email address"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    required
                    className="h-12 text-body"
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className="text-body font-medium text-foreground block mb-2">Phone</label>
                  <Input
                    id="contact-phone"
                    type="tel"
                    placeholder="Your phone number"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    required
                    className="h-12 text-body"
                  />
                </div>
                <div>
                  <label htmlFor="contact-project-type" className="text-body font-medium text-foreground block mb-2">Project Type</label>
                  <Select
                    value={form.projectType}
                    onValueChange={(val) => setForm({ ...form, projectType: val })}
                  >
                    <SelectTrigger id="contact-project-type" className="h-12 text-body">
                      <SelectValue placeholder="Select a project type" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="gravel-driveway">Gravel Driveway</SelectItem>
                      <SelectItem value="material-delivery">Material Delivery</SelectItem>
                      <SelectItem value="pond-construction">Pond Construction</SelectItem>
                      <SelectItem value="dirt-work">Dirt Work</SelectItem>
                      <SelectItem value="drainage">Drainage / Pond Fix</SelectItem>
                      <SelectItem value="hauling">Aggregate Hauling</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label htmlFor="contact-message" className="text-body font-medium text-foreground block mb-2">Message</label>
                  <Textarea
                    id="contact-message"
                    placeholder="Tell us about your project..."
                    value={form.message}
                    onChange={(e) => setForm({ ...form, message: e.target.value })}
                    rows={5}
                    className="text-body"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-primary text-primary-foreground hover:bg-primary/85 font-heading text-h4 tracking-wider px-8 h-14 min-h-[48px] w-full transition-transform hover:-translate-y-0.5 disabled:opacity-70"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      SENDING...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-5 w-5" />
                      SEND MESSAGE
                    </>
                  )}
                </Button>
              </form>
            </div>

            {/* Contact Info */}
            <div>
              <h2 className="font-heading text-h3 text-foreground mb-6">GET IN TOUCH</h2>
              <div className="space-y-6">
                <ContactActionSheet>
                  {({ onClick }) => (
                    <button
                      onClick={onClick}
                      className="flex items-center gap-4 bg-light-gray border border-border rounded-lg p-5 hover:border-primary transition-colors group w-full text-left"
                    >
                      <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                        <Phone className="h-7 w-7 text-primary" />
                      </div>
                      <div>
                        <p className="font-heading text-h4 text-foreground">CALL OR TEXT</p>
                        <p className="text-body text-muted-foreground">Tap to call or text for a quote</p>
                      </div>
                    </button>
                  )}
                </ContactActionSheet>

                <div className="flex items-start gap-4 bg-light-gray border border-border rounded-lg p-5">
                  <div className="w-14 h-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <MapPin className="h-7 w-7 text-primary" />
                  </div>
                  <div>
                    <p className="font-heading text-h4 text-foreground">LOCATION</p>
                    <p className="text-body text-muted-foreground">
                      7653 S FM 148<br />
                      Kaufman, TX
                    </p>
                  </div>
                </div>

                <div className="bg-industrial rounded-lg p-6">
                  <h3 className="font-heading text-h4 text-primary mb-3">SERVICE AREA</h3>
                  <p className="text-body text-gravel mb-4">
                    We serve Kaufman County and surrounding areas within approximately a 30-mile radius.
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-body text-gravel">
                    {["Kaufman", "Terrell", "Forney", "Crandall", "Kemp", "Mabank"].map((area) => (
                      <div key={area} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-primary" />
                        {area}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <CTASection
        headline="NEED A QUICK QUOTE?"
        subtext="Skip the form — just call or text us directly."
        showContact={false}
      />
    </>
  );
};

export default Contact;
