export const CUSTOMER_EMAIL_LOGO = 'https://dugmcjpistrxxryaubkd.supabase.co/storage/v1/object/public/email-assets//MT-LOGO.png'

export type EmailRenderResult = {
  subject: string
  preheader: string
  html: string
  text: string
}

export type QuoteEmailData = {
  customerFirstName: string
  customerName: string
  quoteNumber: string
  createdDate: string
  total: string
  materials: Array<{ name: string; detail: string }>
  delivery?: { title: string; detail?: string }
  customWork?: Array<{ title: string; detail?: string }>
  quoteUrl: string
  privacyUrl: string
  termsUrl: string
}

export type InvoiceEmailData = {
  customerFirstName: string
  customerName: string
  invoiceNumber: string
  issuedDate: string
  dueDate: string
  amountDue: string
  paymentStatus: string
  job?: { title: string; detail?: string }
  ticketNumbers: string[]
  invoiceUrl: string
  privacyUrl: string
  termsUrl: string
}

export type PaymentEmailData = {
  customerFirstName: string
  customerName: string
  invoiceNumber: string
  amountReceived: string
  paymentDate: string
  paymentMethod: string
  job?: string
  receiptUrl: string
  privacyUrl: string
  termsUrl: string
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
}

const styles = `<style>
html,body{margin:0!important;padding:0!important;width:100%!important;background:#0d0e10}table,td{border-collapse:collapse!important;mso-table-lspace:0pt!important;mso-table-rspace:0pt!important}img{border:0;outline:none;text-decoration:none;display:block;-ms-interpolation-mode:bicubic}a{text-decoration:none}.shell{width:100%;max-width:620px}.body{font-family:Arial,Helvetica,sans-serif}.pad{padding-left:34px;padding-right:34px}.meta-col{width:33.333%}@media only screen and (max-width:640px){.pad{padding-left:22px!important;padding-right:22px!important}.title{font-size:36px!important;line-height:40px!important}.amount{font-size:44px!important;line-height:48px!important}.meta-col{display:block!important;width:100%!important;padding:0 0 16px 0!important}.meta-col.last{padding-bottom:0!important}.button{display:block!important;width:100%!important;box-sizing:border-box!important}}
</style>`

function start(title: string, preheader: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting"><title>${escapeHtml(title)}</title>${styles}</head><body style="margin:0;padding:0;background:#0d0e10"><div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(preheader)}</div><table role="presentation" width="100%" bgcolor="#0d0e10" style="width:100%;background:#0d0e10"><tr><td align="center"><table role="presentation" class="shell" width="620" style="width:100%;max-width:620px">`
}

function header(label: string, title: string, intro: string, labelColor = '#8FCBFF'): string {
  return `<tr><td align="center" class="pad" style="padding-top:42px;padding-bottom:22px"><img src="${CUSTOMER_EMAIL_LOGO}" width="132" alt="Monkey Trucking" style="width:132px;max-width:132px;height:auto;margin:0 auto"></td></tr><tr><td align="center" class="pad body" style="padding-bottom:10px;color:${labelColor};font-size:10px;font-weight:700;letter-spacing:2px;text-transform:uppercase">${escapeHtml(label)}</td></tr><tr><td align="center" class="pad body title" style="padding-bottom:14px;color:#f3f3f1;font-size:42px;line-height:46px;font-weight:800;letter-spacing:-1.4px;text-transform:uppercase">${escapeHtml(title)}</td></tr><tr><td align="center" class="pad body" style="padding-bottom:30px;color:#9b9da3;font-size:15px;line-height:24px">${escapeHtml(intro)}</td></tr><tr><td class="pad" style="padding-bottom:26px"><table role="presentation" width="100%"><tr><td style="height:2px;background:#ff003c;font-size:0;line-height:0">&nbsp;</td></tr></table></td></tr>`
}

function amountPanel(label: string, amount: string, detail: string, paid = false): string {
  const background = paid ? '#78D69A' : '#15161a'
  const border = paid ? '#6AC489' : '#26282d'
  const ink = paid ? '#0B0D0C' : '#ffffff'
  const muted = paid ? '#21422B' : '#70737a'
  return `<tr><td class="pad" style="padding-bottom:24px"><table role="presentation" width="100%" bgcolor="${background}" style="width:100%;background:${background};border:1px solid ${border};border-radius:16px;overflow:hidden"><tr><td align="center" class="body" style="padding:28px 28px 8px;color:${paid ? '#0B0D0C' : '#8a8d94'};font-size:10px;font-weight:800;letter-spacing:1.8px;text-transform:uppercase">${escapeHtml(label)}</td></tr><tr><td align="center" class="body amount" style="padding:0 28px;color:${ink};font-size:52px;line-height:56px;font-weight:800;letter-spacing:-2px">${escapeHtml(amount)}</td></tr><tr><td align="center" class="body" style="padding:11px 28px 26px;color:${muted};font-size:11px;line-height:17px;font-weight:${paid ? '700' : '400'}">${escapeHtml(detail)}</td></tr></table></td></tr>`
}

function sectionIntro(title: string, copy: string): string {
  return `<tr><td class="pad body" style="padding-top:6px;padding-bottom:11px;color:#f1f1ef;font-size:20px;font-weight:700;letter-spacing:-.3px">${escapeHtml(title)}</td></tr><tr><td class="pad body" style="padding-bottom:22px;color:#7f8289;font-size:13px;line-height:20px">${escapeHtml(copy)}</td></tr>`
}

function detailRows(rows: Array<{ label: string; title: string; detail?: string }>): string {
  return `<tr><td class="pad" style="padding-bottom:28px"><table role="presentation" width="100%" bgcolor="#121316" style="width:100%;background:#121316;border:1px solid #23252a;border-radius:16px;overflow:hidden"><tr><td style="padding:0 24px"><table role="presentation" width="100%">${rows.map((row, index) => `${index ? '<tr><td style="height:1px;background:#24262b;font-size:0;line-height:0">&nbsp;</td></tr>' : ''}<tr><td class="body" style="padding:${index === 0 ? '22px' : '18px'} 0 ${index === rows.length - 1 ? '22px' : '18px'}"><div style="color:#8FCBFF;font-size:9px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase;margin-bottom:7px">${escapeHtml(row.label)}</div><div style="color:#f4f4f2;font-size:16px;font-weight:700;line-height:22px">${escapeHtml(row.title)}</div>${row.detail ? `<div style="color:#8e9198;font-size:13px;line-height:20px">${escapeHtml(row.detail)}</div>` : ''}</td></tr>`).join('')}</table></td></tr></table></td></tr>`
}

function cta(url: string, label: string, note: string, neutral = false): string {
  return `<tr><td align="center" class="pad" style="padding-bottom:14px"><a href="${escapeHtml(url)}" class="button body" style="display:inline-block;background:${neutral ? '#f1f1ee' : '#ff003c'};color:${neutral ? '#111214' : '#ffffff'};border:1px solid ${neutral ? '#f1f1ee' : '#ff003c'};font-size:13px;font-weight:800;letter-spacing:1px;text-align:center;text-transform:uppercase;padding:16px 34px;border-radius:10px">${escapeHtml(label)}</a></td></tr><tr><td align="center" class="pad body" style="padding-bottom:34px;color:#73767d;font-size:12px;line-height:18px">${escapeHtml(note)}</td></tr>`
}

function meta(rows: Array<{ label: string; value: string }>): string {
  return `<tr><td style="padding:0 0 30px"><table role="presentation" width="100%" bgcolor="#111214" style="width:100%;background:#111214;border-top:1px solid #202226;border-bottom:1px solid #202226"><tr><td class="pad" style="padding-top:20px;padding-bottom:20px"><table role="presentation" width="100%"><tr>${rows.map((row, index) => `<td class="meta-col${index === rows.length - 1 ? ' last' : ''} body" valign="top" style="${index < rows.length - 1 ? 'padding-right:18px' : ''}"><div style="color:#666970;font-size:9px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase;margin-bottom:5px">${escapeHtml(row.label)}</div><div style="color:#dededb;font-size:13px;font-weight:700">${escapeHtml(row.value)}</div></td>`).join('')}</tr></table></td></tr></table></td></tr>`
}

function end(privacyUrl: string, termsUrl: string): string {
  return `<tr><td align="center" class="pad" style="padding-bottom:14px"><img src="${CUSTOMER_EMAIL_LOGO}" width="82" alt="Monkey Trucking" style="width:82px;max-width:82px;height:auto;margin:0 auto;opacity:.82"></td></tr><tr><td align="center" class="pad body" style="padding-bottom:4px;color:#d0d1ce;font-size:11px;font-weight:700;line-height:18px">Monkey Trucking LLC</td></tr><tr><td align="center" class="pad body" style="padding-bottom:15px;color:#676a70;font-size:10px;line-height:17px">7653 S FM 148 · Kaufman, TX 75142</td></tr><tr><td align="center" class="pad body" style="padding-bottom:38px;color:#5f6268;font-size:10px;line-height:17px"><a href="${escapeHtml(privacyUrl)}" style="color:#787b82">Privacy Policy</a>&nbsp;&nbsp;·&nbsp;&nbsp;<a href="${escapeHtml(termsUrl)}" style="color:#787b82">Terms &amp; Conditions</a></td></tr></table></td></tr></table></body></html>`
}

export function renderQuoteReadyEmail(data: QuoteEmailData): EmailRenderResult {
  const preheader = 'Your Monkey Trucking quote is ready to review.'
  const details = [
    ...data.materials.map((item) => ({ label: 'MATERIAL', title: item.name, detail: item.detail })),
    ...(data.delivery ? [{ label: 'DELIVERY', title: data.delivery.title, detail: data.delivery.detail }] : []),
    ...(data.customWork ?? []).map((item) => ({ label: 'WORK', title: item.title, detail: item.detail })),
  ]
  const html = start('Your Monkey Trucking quote is ready', preheader)
    + header(`QUOTE ${data.quoteNumber}`, 'Your quote is ready', `hey ${data.customerFirstName}, we put together the quote for your work. everything is summarized below, and you can open the full quote anytime.`)
    + amountPanel('TOTAL QUOTE', data.total, `${data.quoteNumber}  •  ${data.createdDate}`)
    + sectionIntro('What’s included', 'A clean summary of the material, delivery, and work included in this quote.')
    + detailRows(details)
    + cta(data.quoteUrl, 'View quote', 'questions about the quote? just reply to this email.')
    + meta([{ label: 'QUOTE', value: data.quoteNumber }, { label: 'CREATED', value: data.createdDate }, { label: 'CUSTOMER', value: data.customerName }])
    + end(data.privacyUrl, data.termsUrl)
  const lines = details.map((item) => `${item.label}: ${item.title}${item.detail ? ` — ${item.detail}` : ''}`)
  return { subject: 'Your Monkey Trucking quote is ready', preheader, html, text: `hey ${data.customerFirstName}, your Monkey Trucking quote ${data.quoteNumber} is ready.\n\nTotal: ${data.total}\n${lines.join('\n')}\n\nView quote: ${data.quoteUrl}` }
}

export function renderInvoiceReadyEmail(data: InvoiceEmailData): EmailRenderResult {
  const preheader = 'Your Monkey Trucking invoice is ready to review.'
  const details = [
    ...(data.job ? [{ label: 'JOB', title: data.job.title, detail: data.job.detail }] : []),
    { label: 'INVOICE', title: data.invoiceNumber, detail: `Issued ${data.issuedDate}` },
    ...(data.ticketNumbers.length ? [{ label: 'TICKETS', title: data.ticketNumbers.join(' · ') }] : []),
  ]
  const statusStrip = `<tr><td style="padding:0 0 28px"><table role="presentation" width="100%" bgcolor="#121316" style="width:100%;background:#121316;border-top:1px solid #202226;border-bottom:1px solid #202226"><tr><td class="pad body" style="padding-top:18px;padding-bottom:18px"><span style="color:#666970;font-size:10px;font-weight:700;letter-spacing:1.4px;text-transform:uppercase">PAYMENT STATUS</span><span style="display:inline-block;margin-left:10px;color:#f0f0ed;font-size:12px;font-weight:700">${escapeHtml(data.paymentStatus)}</span></td></tr></table></td></tr>`
  const html = start('Your Monkey Trucking invoice is ready', preheader)
    + header(`INVOICE ${data.invoiceNumber}`, 'Your invoice is ready', `hey ${data.customerFirstName}, your work is complete and the invoice is ready. you can review the full invoice and payment details below.`)
    + amountPanel('AMOUNT DUE', data.amountDue, `Due ${data.dueDate}`)
    + statusStrip
    + sectionIntro('Invoice summary', 'The key details are below. open the full invoice for the complete breakdown.')
    + detailRows(details)
    + cta(data.invoiceUrl, 'View invoice', 'questions about the invoice? just reply to this email.')
    + meta([{ label: 'INVOICE', value: data.invoiceNumber }, { label: 'DUE', value: data.dueDate }, { label: 'CUSTOMER', value: data.customerName }])
    + end(data.privacyUrl, data.termsUrl)
  return { subject: 'Your Monkey Trucking invoice is ready', preheader, html, text: `hey ${data.customerFirstName}, your Monkey Trucking invoice ${data.invoiceNumber} is ready.\n\nAmount due: ${data.amountDue}\nDue: ${data.dueDate}\nStatus: ${data.paymentStatus}\n\nView invoice: ${data.invoiceUrl}` }
}

export function renderPaymentReceivedEmail(data: PaymentEmailData): EmailRenderResult {
  const preheader = 'We received your payment. Thank you for choosing Monkey Trucking.'
  const details = [
    { label: 'INVOICE', title: data.invoiceNumber, detail: 'Paid in full' },
    { label: 'PAYMENT METHOD', title: data.paymentMethod },
    ...(data.job ? [{ label: 'JOB', title: data.job }] : []),
  ]
  const thanks = `<tr><td align="center" class="pad body" style="padding:4px 10px 30px;color:#c3c4c0;font-size:15px;line-height:24px">we appreciate you trusting Monkey Trucking with the work. if you need anything else, just reply to this email and we’ll be here.</td></tr>`
  const html = start('Payment received by Monkey Trucking', preheader)
    + header('PAYMENT CONFIRMED', 'Payment received', `thank you ${data.customerFirstName}. your payment has been recorded, and the invoice is now paid in full.`, '#7fc695')
    + amountPanel('PAYMENT RECEIVED', data.amountReceived, data.paymentDate, true)
    + thanks
    + sectionIntro('Receipt details', 'A record of the payment tied to this invoice.')
    + detailRows(details)
    + cta(data.receiptUrl, 'View receipt', 'need anything else? just reply to this email.', true)
    + meta([{ label: 'INVOICE', value: data.invoiceNumber }, { label: 'PAID', value: data.paymentDate }, { label: 'CUSTOMER', value: data.customerName }])
    + end(data.privacyUrl, data.termsUrl)
  return { subject: 'Payment received by Monkey Trucking', preheader, html, text: `thank you ${data.customerFirstName}. we received ${data.amountReceived} by ${data.paymentMethod} on ${data.paymentDate}.\n\nInvoice: ${data.invoiceNumber}\nView receipt: ${data.receiptUrl}` }
}
