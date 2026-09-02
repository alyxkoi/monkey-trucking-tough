import { createClient } from 'npm:@supabase/supabase-js@2'
import { renderRequestReceivedEmail } from '../_shared/request-received-email.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
}

const SMS_CONSENT_SOURCE = 'website_contact_form'
const SMS_CONSENT_VERSION = 'website-contact-v1-2026-08-27'
const SMS_CONSENT_DISCLOSURE = 'I agree to receive customer care text messages from Monkey Trucking LLC regarding quotes, scheduling, deliveries, job updates, and service questions. Message frequency varies. Msg & data rates may apply. Reply HELP for help or STOP to opt out. Consent is not a condition of purchase. See our Privacy Policy and Terms & Conditions.'
const SITE_ORIGIN = (Deno.env.get('PUBLIC_SITE_URL') ?? 'https://www.monkeytrucking.llc').replace(/\/$/, '')
const FROM = 'Monkey Trucking <no-reply@notify.monkeytrucking.llc>'
const REPLY_TO = 'contact@monkeytrucking.llc'

type EmailPayload = {
  to: string
  from: string
  replyTo: string
  subject: string
  html: string
  text: string
  label: string
  idempotencyKey: string
}

async function queueEmailOnce(supabase: ReturnType<typeof createClient>, input: EmailPayload) {
  const { data: existing } = await supabase.from('email_send_log')
    .select('id,message_id,status')
    .eq('idempotency_key', input.idempotencyKey)
    .maybeSingle()

  if (existing && existing.status !== 'failed' && existing.status !== 'dlq') {
    return { queued: true, duplicate: true }
  }

  const messageId = existing?.message_id ?? crypto.randomUUID()
  let logId = existing?.id as string | undefined
  if (logId) {
    await supabase.from('email_send_log').update({ status: 'pending', error_message: null, attempted_at: new Date().toISOString() }).eq('id', logId)
  } else {
    const { data: inserted, error: insertError } = await supabase.from('email_send_log').insert({
      message_id: messageId,
      template_name: input.label,
      template_type: input.label.toUpperCase().replaceAll('-', '_'),
      recipient_email: input.to,
      status: 'pending',
      idempotency_key: input.idempotencyKey,
      sender_email: 'no-reply@notify.monkeytrucking.llc',
      reply_to: input.replyTo,
      attempted_at: new Date().toISOString(),
    }).select('id').single()
    if (insertError) {
      if (insertError.code === '23505') return { queued: true, duplicate: true }
      throw insertError
    }
    logId = inserted.id
  }

  const { error: queueError } = await supabase.rpc('enqueue_email', {
    queue_name: 'transactional_emails',
    payload: {
      message_id: messageId,
      to: input.to,
      from: input.from,
      reply_to: input.replyTo,
      sender_domain: 'notify.monkeytrucking.llc',
      subject: input.subject,
      html: input.html,
      text: input.text,
      purpose: 'transactional',
      label: input.label,
      idempotency_key: input.idempotencyKey,
      queued_at: new Date().toISOString(),
    },
  })
  if (queueError) {
    if (logId) await supabase.from('email_send_log').update({ status: 'failed', error_message: queueError.message }).eq('id', logId)
    throw queueError
  }
  return { queued: true, duplicate: false }
}

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
      location,
      message,
      smsConsent: requestedSmsConsent,
      smsDisclosureVersion,
      trackingAttribution,
      clientRequestId,
    } = await req.json()

    if (!name || !phone) {
      return new Response(
        JSON.stringify({ error: 'Name and phone are required' }),
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
    const safeEmail = escapeHtml(email?.trim() || 'Not provided')
    const safePhone = escapeHtml(phone)
    const safeProjectTypeLabel = escapeHtml(projectTypeLabel)
    const safeLocation = escapeHtml(location || 'Not provided')
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
            <td style="padding: 8px 12px; color: #333;">${email?.trim() ? `<a href="mailto:${safeEmail}" style="color: #F97316;">${safeEmail}</a>` : safeEmail}</td>
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
            <td style="padding: 8px 12px; font-weight: bold; color: #555; vertical-align: top;">Location:</td>
            <td style="padding: 8px 12px; color: #333;">${safeLocation}</td>
          </tr>
          <tr>
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

    const textBody = `New Contact Form Submission\n\nName: ${name}\nEmail: ${email?.trim() || 'Not provided'}\nPhone: ${phone}\nProject Type: ${projectTypeLabel}\nLocation: ${location || 'Not provided'}\nMessage: ${message || 'No message provided'}\nSMS consent: ${safeSmsConsent}\nConsent disclosure: ${SMS_CONSENT_VERSION}`

    const messageId = typeof clientRequestId === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(clientRequestId)
      ? clientRequestId
      : crypto.randomUUID()

    const baseSubmission = {
      email_message_id: messageId,
      name,
      email: email?.trim() || '',
      phone,
      project_type: projectType || null,
      message: [location ? `Location: ${location}` : '', message || ''].filter(Boolean).join('\n\n') || null,
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

    let submissionId: string | null = null
    let submissionCreated = true
    let submissionError: { message: string; code?: string } | null = null
    const stored = await supabase.rpc('create_website_contact_submission', { p_submission: trackedSubmission })
    if (!stored.error) {
      submissionId = stored.data?.id ?? null
      submissionCreated = stored.data?.created !== false
    } else if (['PGRST202', '42883'].includes(stored.error.code ?? '')) {
      // Deployment-safe fallback while the forward migration is still pending.
      const legacyInsert = await supabase.from('contact_submissions').insert(trackedSubmission).select('id').single()
      submissionId = legacyInsert.data?.id ?? null
      submissionError = legacyInsert.error
      if (legacyInsert.error?.code === '23505') {
        const existing = await supabase.from('contact_submissions').select('id').eq('email_message_id', messageId).maybeSingle()
        submissionId = existing.data?.id ?? null
        submissionCreated = false
        submissionError = existing.error
      }
    } else {
      submissionError = stored.error
    }

    // Keep the public form available if source is deployed before the forward
    // attribution migration. The legacy insert still preserves consent/email;
    // Settings will continue to report Tracking as deployment-required.
    if (submissionError && trackedSubmission !== baseSubmission && ['PGRST204', '42703'].includes(submissionError.code ?? '')) {
      const retry = await supabase.from('contact_submissions').insert(baseSubmission).select('id').single()
      submissionId = retry.data?.id ?? null
      submissionError = retry.error
      if (retry.error?.code === '23505') {
        const existing = await supabase.from('contact_submissions').select('id').eq('email_message_id', messageId).maybeSingle()
        submissionId = existing.data?.id ?? null
        submissionCreated = false
        submissionError = existing.error
      }
    }

    if (submissionError) {
      console.error('Failed to record contact submission:', submissionError)
      return new Response(
        JSON.stringify({ error: 'Failed to record message' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const emailWarnings: string[] = []
    if (submissionId) {
      try {
        await queueEmailOnce(supabase, {
          to: 'contact@monkeytrucking.llc',
          from: FROM,
          replyTo: email?.trim() || REPLY_TO,
          subject: `New Contact: ${name} / ${projectTypeLabel}`,
          html: htmlBody,
          text: textBody,
          label: 'contact-form',
          idempotencyKey: `contact-form:${submissionId}`,
        })
      } catch (error) {
        console.error('Contact notification queue failed after the request was stored:', error)
        emailWarnings.push('internal_notification_queue_failed')
      }

      if (email?.trim()) {
        try {
          const customerEmail = renderRequestReceivedEmail({
            customerName: name.trim(),
            requestType: projectTypeLabel,
            serviceLocation: location?.trim() || 'Not provided',
            submittedAt: new Date().toLocaleString('en-US', { timeZone: 'America/Chicago', dateStyle: 'medium', timeStyle: 'short' }),
            privacyUrl: `${SITE_ORIGIN}/privacy-policy`,
            termsUrl: `${SITE_ORIGIN}/terms`,
          })
          await queueEmailOnce(supabase, {
            to: email.trim(),
            from: FROM,
            replyTo: REPLY_TO,
            subject: customerEmail.subject,
            html: customerEmail.html,
            text: customerEmail.text,
            label: 'request-received',
            idempotencyKey: `request-received:${submissionId}`,
          })
        } catch (error) {
          console.error('Request-received confirmation queue failed after the request was stored:', error)
          emailWarnings.push('customer_confirmation_queue_failed')
        }
      }
    }

    return new Response(
      JSON.stringify({ success: true, submissionId, idempotent: !submissionCreated, emailWarnings }),
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
