const TEMPLATE = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="x-apple-disable-message-reformatting">
  <title>Monkey Trucking received your request</title>
  <style>
    html, body { margin:0 !important; padding:0 !important; width:100% !important; background:#0d0e10; }
    table, td { border-collapse:collapse !important; mso-table-lspace:0pt !important; mso-table-rspace:0pt !important; }
    img { border:0; outline:none; text-decoration:none; display:block; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    .shell { width:100%; max-width:620px; }
    .body { font-family:Arial, Helvetica, sans-serif; }
    .pad { padding-left:34px; padding-right:34px; }
    .meta-col { width:50%; }
    @media only screen and (max-width:640px) {
      .pad { padding-left:22px !important; padding-right:22px !important; }
      .title { font-size:36px !important; line-height:40px !important; }
      .meta-col { display:block !important; width:100% !important; padding:0 0 16px 0 !important; }
      .meta-col.last { padding-bottom:0 !important; }
      .button { display:block !important; width:100% !important; box-sizing:border-box !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background:#0d0e10;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">
    Monkey Trucking received your request and will follow up shortly.
  </div>
  <table role="presentation" width="100%" bgcolor="#0d0e10" style="width:100%;background:#0d0e10;">
    <tr><td align="center">
      <table role="presentation" class="shell" width="620" style="width:100%;max-width:620px;">
        <tr><td align="center" class="pad" style="padding-top:42px;padding-bottom:22px;">
          <img src="https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/email-assets//MT-LOGO.png" width="132" alt="Monkey Trucking" style="width:132px;max-width:132px;height:auto;margin:0 auto;">
        </td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:10px;color:#ff003c;font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">REQUEST RECEIVED</td></tr>
        <tr><td align="center" class="pad body title" style="padding-bottom:14px;color:#f3f3f1;font-size:42px;line-height:46px;font-weight:800;letter-spacing:-1.4px;text-transform:uppercase;">We received your request</td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:30px;color:#9b9da3;font-size:15px;line-height:24px;">hey {{CUSTOMER_NAME}}, thanks for reaching out to Monkey Trucking. we received your request and will follow up with you shortly.</td></tr>
        <tr><td class="pad" style="padding-bottom:26px;"><table role="presentation" width="100%" style="width:100%;"><tr><td style="height:2px;background:#ff003c;font-size:0;line-height:0;">&nbsp;</td></tr></table></td></tr>
        <tr><td class="pad body" style="padding-top:4px;padding-bottom:11px;color:#f1f1ef;font-size:20px;font-weight:700;letter-spacing:-0.3px;">Request summary</td></tr>
        <tr><td class="pad body" style="padding-bottom:22px;color:#7f8289;font-size:13px;line-height:20px;">A quick copy of the information we received from your request.</td></tr>
        <tr><td class="pad" style="padding-bottom:28px;">
          <table role="presentation" width="100%" bgcolor="#121316" style="width:100%;background:#121316;border:1px solid #23252a;border-radius:16px;overflow:hidden;">
            <tr><td style="padding:0 24px;"><table role="presentation" width="100%">
              <tr><td class="body" style="padding:22px 0 18px 0;">
                <div style="color:#ff003c;font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:7px;">WHAT YOU NEED</div>
                <div style="color:#f4f4f2;font-size:16px;font-weight:700;line-height:22px;">{{REQUEST_TYPE}}</div>
              </td></tr>
              <tr><td style="height:1px;background:#24262b;font-size:0;line-height:0;">&nbsp;</td></tr>
              <tr><td class="body" style="padding:18px 0 22px 0;">
                <div style="color:#ff003c;font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:7px;">LOCATION</div>
                <div style="color:#f4f4f2;font-size:16px;font-weight:700;line-height:22px;">{{SERVICE_LOCATION}}</div>
              </td></tr>
            </table></td></tr>
          </table>
        </td></tr>
        <tr><td align="center" class="pad" style="padding-bottom:14px;">
          <a href="sms:+12146778466" class="button body" style="display:inline-block;background:#f1f1ee;color:#111214;border:1px solid #f1f1ee;font-size:13px;font-weight:800;letter-spacing:1px;text-align:center;text-transform:uppercase;padding:16px 34px;border-radius:10px;">Text Monkey Trucking</a>
        </td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:34px;color:#73767d;font-size:12px;line-height:18px;">need to add something? just reply to this email or text us at 214-677-8466.</td></tr>
        <tr><td style="padding:0 0 30px 0;">
          <table role="presentation" width="100%" bgcolor="#111214" style="width:100%;background:#111214;border-top:1px solid #202226;border-bottom:1px solid #202226;">
            <tr><td class="pad" style="padding-top:20px;padding-bottom:20px;"><table role="presentation" width="100%"><tr>
              <td class="meta-col body" valign="top" style="padding-right:18px;"><div style="color:#666970;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:5px;">RECEIVED</div><div style="color:#dededb;font-size:13px;font-weight:700;">{{SUBMITTED_AT}}</div></td>
              <td class="meta-col last body" valign="top"><div style="color:#666970;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:5px;">CUSTOMER</div><div style="color:#dededb;font-size:13px;font-weight:700;">{{CUSTOMER_NAME}}</div></td>
            </tr></table></td></tr>
          </table>
        </td></tr>
        <tr><td align="center" class="pad" style="padding-bottom:14px;"><img src="https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/email-assets//MT-LOGO.png" width="82" alt="Monkey Trucking" style="width:82px;max-width:82px;height:auto;margin:0 auto;opacity:.82;"></td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:4px;color:#d0d1ce;font-size:11px;font-weight:700;line-height:18px;">Monkey Trucking LLC</td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:15px;color:#676a70;font-size:10px;line-height:17px;">7653 S FM 148 · Kaufman, TX 75142</td></tr>
        <tr><td align="center" class="pad body" style="padding-bottom:38px;color:#5f6268;font-size:10px;line-height:17px;"><a href="{{PRIVACY_URL}}" style="color:#787b82;">Privacy Policy</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="{{TERMS_URL}}" style="color:#787b82;">Terms &amp; Conditions</a></td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`

const escapeHtml = (value: unknown): string => String(value ?? '')
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#39;')

export type RequestReceivedEmailInput = {
  customerName: string
  requestType: string
  serviceLocation: string
  submittedAt: string
  privacyUrl: string
  termsUrl: string
}

export function renderRequestReceivedEmail(input: RequestReceivedEmailInput) {
  const replacements: Record<string, string> = {
    CUSTOMER_NAME: input.customerName,
    REQUEST_TYPE: input.requestType,
    SERVICE_LOCATION: input.serviceLocation,
    SUBMITTED_AT: input.submittedAt,
    PRIVACY_URL: input.privacyUrl,
    TERMS_URL: input.termsUrl,
  }
  const html = Object.entries(replacements).reduce(
    (output, [key, value]) => output.replaceAll(`{{${key}}}`, escapeHtml(value)),
    TEMPLATE,
  )
  return {
    subject: 'Monkey Trucking received your request',
    html,
    text: `hey ${input.customerName}, thanks for reaching out to Monkey Trucking. we received your request and will follow up shortly.\n\nWhat you need: ${input.requestType}\nLocation: ${input.serviceLocation}\nReceived: ${input.submittedAt}\n\nNeed to add something? reply to this email or text 214-677-8466.`,
  }
}
