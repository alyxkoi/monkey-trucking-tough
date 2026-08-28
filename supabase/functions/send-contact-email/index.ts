import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SMS_CONSENT_SOURCE = 'website_contact_form'
const SMS_CONSENT_VERSION = 'website-contact-v1-2026-08-27'
const SMS_CONSENT_DISCLOSURE = 'I agree to receive customer care text messages from Monkey Trucking LLC regarding quotes, scheduling, deliveries, job updates, and service questions. Message frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase. See our Privacy Policy and Terms & Conditions.'

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(
      JSON.stringify({ error: 'Server configuration error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  try {
    const {
      name,
      email,
      phone,
      projectType,
      message,
      smsConsent: requestedSmsConsent,
      smsDisclosureVersion,
      trackingAttribution,
    } = await req.json()

    if (!name || !phone || !email) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (smsDisclosureVersion !== SMS_CONSENT_VERSION) {
      return new Response(
        JSON.stringify({ error: 'The contact form disclosure is out of date. Please refresh and try again.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Only an explicit checked state is consent. Missing, false, and all other
    // values remain false and must never trigger automated customer messaging.
    const smsConsent = requestedSmsConsent === true

    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    const projectTypeLabel = projectType
      ? projectType.replace(/-/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase())
      : 'Not specified'

    // All values interpolated into HTML are attacker-controlled contact-form data.
    const safeName = escapeHtml(name)
    const safeEmail = escapeHtml(email)
    const safePhone = escapeHtml(phone)
    const safeProjectTypeLabel = escapeHtml(projectTypeLabel)
    const safeMessage = escapeHtml(message || 'No message provided')

    const safeSmsConsent = smsConsent ? 'Yes' : 'No'

    const htmlBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #F97316; padding-bottom: 10px;">New Contact Form Submission</h2>
        <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
           <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555; width: 140px;">Name:</td>
             <td style="padding: 8px 12px; color: #333;">${safeName}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Email:</td>
             <td style="padding: 8px 12px; color: #333;"><a href="mailto:${safeEmail}" style="color: #F97316;">${safeEmail}</a></td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Phone:</td>
             <td style="padding: 8px 12px; color: #333;">${safePhone}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555;">Project Type:</td>
             <td style="padding: 8px 12px; color: #333;">${safeProjectTypeLabel}</td>
          </tr>
          <tr style="background-color: #f9f9f9;">
            <td style="padding: 8px 12px; font-weight: bold; color: #555; vertical-align: top;">Message:</td>
             <td style="padding: 8px 12px; color: #333; white-space: pre-wrap;">${safeMessage}</td>
          </tr>
          <tr>
            <td style="padding: 8px 12px; font-weight: bold; color: #555; vertical-align: top;">SMS consent:</td>
            <td style="padding: 8px 12px; color: #333;">${safeSmsConsent}<br><span style="font-size: 12px; color: #777;">${SMS_CONSENT_VERSION}</span></td>
          </tr>
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">This email was sent from the Monkey Trucking website contact form.</p>
      </div>
    `

    const textBody = `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nProject Type: ${projectTypeLabel}\nMessage: ${message || 'No message provided'}\nSMS consent: ${safeSmsConsent}\nConsent disclosure: ${SMS_CONSENT_VERSION}`

    const messageId = crypto.randomUUID()

    const baseSubmission = {
      email_message_id: messageId,
      name,
      email,
      phone,
      project_type: projectType || null,
      message: message || null,
      sms_consent: smsConsent,
      sms_consent_at: smsConsent ? new Date().toISOString() : null,
      consent_source: SMS_CONSENT_SOURCE,
      consent_disclosure_version: SMS_CONSENT_VERSION,
      consent_disclosure_text: SMS_CONSENT_DISCLOSURE,
    }
    const trackingLinkId = trackingAttribution && typeof trackingAttribution === 'object'
      && typeof trackingAttribution.trackingLinkId === 'string'
      && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(trackingAttribution.trackingLinkId)
      ? trackingAttribution.trackingLinkId
      : null
    const trackedSubmission = trackingAttribution && typeof trackingAttribution === 'object'
      ? {
          ...baseSubmission,
          tracking_link_id: trackingLinkId,
          source: typeof trackingAttribution.source === 'string' ? trackingAttribution.source : null,
          campaign: typeof trackingAttribution.campaign === 'string' ? trackingAttribution.campaign : null,
        }
      : baseSubmission

    let { error: submissionError } = await supabase.from('contact_submissions').insert(trackedSubmission)

    // Keep the public form available if source is deployed before the forward
    // attribution migration. The legacy insert still preserves consent/email;
    // Settings will continue to report Tracking as deployment-required.
    if (submissionError && trackedSubmission !== baseSubmission && ['PGRST204', '42703'].includes(submissionError.code ?? '')) {
      const retry = await supabase.from('contact_submissions').insert(baseSubmission)
      submissionError = retry.error
    }

    if (submissionError) {
      console.error('Failed to record contact submission:', submissionError)
      return new Response(
        JSON.stringify({ error: 'Failed to record message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Log pending before enqueue
    await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: 'contact-form',
      recipient_email: 'contact@monkeytrucking.llc',
      status: 'pending',
    })

    const { error: queueError } = await supabase.rpc('enqueue_email', {
      queue_name: 'transactional_emails',
      payload: {
        message_id: messageId,
        run_id: 'c8457e53-2ec7-43b2-9924-50a2b4016be2',
        to: 'contact@monkeytrucking.llc',
        from: `${name} <no-reply@notify.monkeytrucking.llc>`,
        reply_to: email,
        sender_domain: 'notify.monkeytrucking.llc',
        subject: `New Contact: ${name} — ${projectTypeLabel}`,
        html: htmlBody,
        text: textBody,
        purpose: 'transactional',
        label: 'contact-form',
        queued_at: new Date().toISOString(),
      },
    })

    if (queueError) {
      console.error('Failed to queue email:', queueError)
      return new Response(
        JSON.stringify({ error: 'Failed to send message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error processing contact form:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
