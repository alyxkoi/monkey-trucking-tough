import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

const Terms = () => (
  <>
    <Seo
      title="Terms & Conditions | Monkey Trucking LLC"
      description="Website, service, quote, scheduling, payment, and customer care messaging terms for Monkey Trucking LLC."
      path="/terms"
    />
    <LegalPage title="TERMS & CONDITIONS" updated="August 27, 2026">
      <LegalSection title="ABOUT THESE TERMS">
        <p>
          These Terms &amp; Conditions govern use of the Monkey Trucking LLC website and provide a practical baseline for website inquiries and customer care messaging. Monkey Trucking LLC is located at 7653 S FM 148, Kaufman, TX 75142.
        </p>
        <p>By using the website, you agree to use it lawfully and consistently with these Terms.</p>
      </LegalSection>

      <LegalSection title="WEBSITE INFORMATION AND USE">
        <p>
          Website content is provided for general information about Monkey Trucking services, materials, and service areas. It is not a binding quote, guarantee of availability, engineering advice, or a promise that a particular service, material, price, crew, truck, or date is available.
        </p>
        <p>
          You may not misuse the website, attempt unauthorized access, interfere with normal operation, submit unlawful or deceptive content, or use site content in a way that violates applicable law or another person's rights.
        </p>
      </LegalSection>

      <LegalSection title="SERVICES, MATERIALS, AND QUOTES">
        <p>
          Service and material availability may change based on supply, site conditions, weather, equipment, staffing, delivery distance, safety, and other current conditions. Quotes and estimates are based on the information available when prepared and are governed by the final approved quote, order, invoice, or agreement.
        </p>
        <p>
          Prices shown or discussed before final approval may change when quantities, material rates, delivery requirements, access conditions, site scope, taxes, or other relevant conditions change.
        </p>
      </LegalSection>

      <LegalSection title="SCHEDULING, DELIVERY, AND SITE ACCESS">
        <p>
          Scheduling and delivery times depend on availability and current operating conditions. Customers are responsible for providing accurate addresses, phone and email information, gate codes, site instructions, access details, requested delivery locations, and other information reasonably needed to perform the work safely and correctly.
        </p>
        <p>
          Customers should identify known hazards, access limitations, underground utilities, weak surfaces, property restrictions, or other site conditions that may affect delivery or work. Schedule changes or delays may be necessary when safe access or required information is unavailable.
        </p>
      </LegalSection>

      <LegalSection title="PAYMENT, CHANGES, AND CANCELLATIONS">
        <p>
          Payment amounts, due dates, accepted methods, deposits, and other payment obligations are governed by the applicable quote, invoice, order, or agreement. Requested changes may affect price, materials, timing, or availability and must be accepted by Monkey Trucking where applicable.
        </p>
        <p>
          Cancellation and rescheduling requests are handled based on the applicable quote or agreement, work already performed, materials ordered or delivered, trucking or crew commitments, and reasonable costs already incurred.
        </p>
      </LegalSection>

      <LegalSection title="SMS TERMS">
        <p className="font-semibold text-foreground">Program: Monkey Trucking LLC Customer Care Messaging</p>
        <p>Messages may include:</p>
        <LegalList>
          <li>Quote communication.</li>
          <li>Scheduling and delivery information.</li>
          <li>Job updates.</li>
          <li>Service questions and customer support.</li>
        </LegalList>
        <p>
          Participation is voluntary, and consent is not a condition of purchase. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. Applicable opt-out requests will stop further non-required SMS communications. Carriers are not responsible for delayed or undelivered messages. Please keep your contact information accurate.
        </p>
        <p>
          Mobile phone numbers, SMS opt-in data, and messaging consent are not shared with third parties or affiliates for marketing or promotional purposes. Service providers may process information only as reasonably necessary to support Monkey Trucking's communications services. See the <Link to="/privacy-policy" className="font-medium text-primary underline underline-offset-2">Privacy Policy</Link> for more information.
        </p>
      </LegalSection>

      <LegalSection title="INTELLECTUAL PROPERTY AND THIRD-PARTY SERVICES">
        <p>
          The website's branding, text, graphics, photographs, and other original content belong to Monkey Trucking LLC or are used with permission and may not be copied or commercially reused without authorization, except as allowed by law.
        </p>
        <p>
          The website may link to or rely on third-party services. Monkey Trucking does not control third-party websites, carrier networks, or service-provider systems and is not responsible for their separate content, terms, privacy practices, delays, or availability.
        </p>
      </LegalSection>

      <LegalSection title="DISCLAIMERS AND LIMITATION OF LIABILITY">
        <p>
          To the extent permitted by law, the website is provided on an as-available basis without promises that it will always be uninterrupted or error-free. Service-specific warranties, if any, are governed by the applicable written quote or agreement.
        </p>
        <p>
          To the extent permitted by law, Monkey Trucking LLC is not liable for indirect, incidental, or consequential losses arising solely from use of, or inability to use, this website. Nothing in these Terms excludes liability that cannot legally be excluded or limits obligations expressly accepted in an applicable quote or agreement.
        </p>
      </LegalSection>

      <LegalSection title="GOVERNING LAW">
        <p>
          These Terms are governed by the laws of the State of Texas, without overriding any consumer protection or other rights that applicable law does not permit the parties to waive.
        </p>
      </LegalSection>

      <LegalSection title="CHANGES TO THESE TERMS">
        <p>
          We may update these Terms as the website, services, or legal requirements change. The updated date at the top of this page identifies the current version.
        </p>
      </LegalSection>

      <LegalSection title="CONTACT MONKEY TRUCKING">
        <p>
          Monkey Trucking LLC<br />
          7653 S FM 148<br />
          Kaufman, TX 75142
        </p>
        <p>
          Questions may be submitted through our <Link to="/contact" className="font-medium text-primary underline underline-offset-2">Contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  </>
);

export default Terms;
