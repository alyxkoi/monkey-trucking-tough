import { Link } from "react-router-dom";
import Seo from "@/components/Seo";
import { LegalList, LegalPage, LegalSection } from "@/components/LegalPage";

const PrivacyPolicy = () => (
  <>
    <Seo
      title="Privacy Policy | Monkey Trucking LLC"
      description="How Monkey Trucking LLC collects, uses, protects, and retains customer and website information, including SMS consent records."
      path="/privacy-policy"
    />
    <LegalPage title="PRIVACY POLICY" updated="August 27, 2026">
      <LegalSection title="ABOUT THIS POLICY">
        <p>
          This Privacy Policy explains how Monkey Trucking LLC collects and uses information when you visit our website, contact us, request a quote, or communicate with us about materials, delivery, or property and site services.
        </p>
        <p>
          Monkey Trucking LLC is located at 7653 S FM 148, Kaufman, TX 75142.
        </p>
      </LegalSection>

      <LegalSection title="INFORMATION WE COLLECT">
        <p>We may collect information you choose to provide, including:</p>
        <LegalList>
          <li>Your name, phone number, email address, project type, service address, and message content.</li>
          <li>Details you provide while discussing a quote, delivery, schedule, job, payment, or service question.</li>
          <li>Your SMS opt-in choice, the date and source of that choice, and the consent disclosure version shown to you.</li>
          <li>Records of communications with Monkey Trucking, including messages needed to serve your request.</li>
        </LegalList>
        <p>
          The current public website does not use advertising pixels. Our hosting, security, and technology providers may process standard technical information such as IP address, browser type, device information, requested pages, and timestamps to operate, protect, and troubleshoot the website.
        </p>
      </LegalSection>

      <LegalSection title="HOW WE USE INFORMATION">
        <p>We use information for legitimate business purposes, including to:</p>
        <LegalList>
          <li>Answer inquiries and service questions.</li>
          <li>Prepare and discuss quotes or material orders.</li>
          <li>Schedule work, coordinate access, and provide delivery or job updates.</li>
          <li>Provide customer support and process payments or other legitimate business activity.</li>
          <li>Maintain business records, prevent misuse, protect the website, and improve our services and website.</li>
        </LegalList>
      </LegalSection>

      <LegalSection title="SMS AND MOBILE INFORMATION">
        <p className="font-semibold text-foreground">
          Monkey Trucking LLC does not share, sell, rent, or provide mobile phone numbers, SMS opt-in data, or messaging consent to third parties or affiliates for marketing or promotional purposes.
        </p>
        <p>
          If you voluntarily opt in, Monkey Trucking may send customer care messages about quotes, scheduling, deliveries, job updates, and service questions. Message frequency varies. Message and data rates may apply. Reply STOP to opt out or HELP for help. SMS consent is not a condition of purchase.
        </p>
        <p>
          Service providers may receive information only when reasonably necessary to support services for Monkey Trucking, such as communications, hosting, security, or technology services. They are not permitted to use mobile information or SMS consent for their own marketing or promotional purposes.
        </p>
      </LegalSection>

      <LegalSection title="WHEN INFORMATION MAY BE DISCLOSED">
        <p>
          We may provide information to service providers working for Monkey Trucking when needed to operate the website, communicate with customers, process legitimate business activity, or provide requested services. We may also disclose information when required by law, to respond to lawful process, or to protect customers, Monkey Trucking, or others from fraud, misuse, or harm.
        </p>
      </LegalSection>

      <LegalSection title="DATA SECURITY AND RETENTION">
        <p>
          We use reasonable administrative, technical, and organizational safeguards appropriate to the information we maintain. No website or storage system can guarantee absolute security.
        </p>
        <p>
          We retain information only as long as reasonably needed to respond to requests, provide services, maintain consent and business records, resolve disputes, meet legal obligations, and protect legitimate business interests. Retention periods may vary by record type.
        </p>
      </LegalSection>

      <LegalSection title="YOUR PRIVACY REQUESTS">
        <p>
          You may ask to review, correct, or delete personal information, subject to records Monkey Trucking must retain for legal, safety, accounting, consent, or other legitimate business reasons. Contact us through the <Link to="/contact" className="font-medium text-primary underline underline-offset-2">Contact page</Link>.
        </p>
      </LegalSection>

      <LegalSection title="CHILDREN'S PRIVACY">
        <p>
          The website and Monkey Trucking services are not directed to children under 13, and we do not knowingly collect personal information from children under 13. If you believe a child has submitted information, please contact us so we can review and address it.
        </p>
      </LegalSection>

      <LegalSection title="POLICY UPDATES">
        <p>
          We may update this Privacy Policy as our services, website, or legal obligations change. The updated date at the top of this page identifies the current version.
        </p>
      </LegalSection>

      <LegalSection title="CONTACT MONKEY TRUCKING">
        <p>
          Monkey Trucking LLC<br />
          7653 S FM 148<br />
          Kaufman, TX 75142
        </p>
        <p>
          Privacy questions may be submitted through our <Link to="/contact" className="font-medium text-primary underline underline-offset-2">Contact page</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  </>
);

export default PrivacyPolicy;
