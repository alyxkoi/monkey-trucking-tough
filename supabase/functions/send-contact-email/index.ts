import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
    const { name, email, phone, projectType, message } = await req.json()

    if (!name || !phone || !email) {
      return new Response(
        JSON.stringify({ error: 'Name, email, and phone are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

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
        </table>
        <p style="margin-top: 20px; font-size: 12px; color: #999;">This email was sent from the Monkey Trucking website contact form.</p>
      </div>
    `

    const textBody = `New Contact Form Submission\n\nName: ${name}\nEmail: ${email}\nPhone: ${phone}\nProject Type: ${projectTypeLabel}\nMessage: ${message || 'No message provided'}`

    const messageId = crypto.randomUUID()

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
