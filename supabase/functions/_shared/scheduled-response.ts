/** Scheduled financial facts are rendered from records, never model arithmetic. */
export type FollowupContext = {
  rule: string; step: number; spanish: boolean; timezone: string;
  invoice: { amount: unknown; invoice_number: string; due_at: string | null; status: string };
  job?: { category: string; status: string } | null;
  reviewUrl?: string | null;
}

export function scheduledResponse(context: FollowupContext): string {
  const { rule, step, spanish: es, invoice, job } = context
  if (rule === 'invoice-follow-up') {
    const amount = Number(invoice.amount)
    if (invoice.status !== 'SENT' || !Number.isFinite(amount) || amount <= 0 || !invoice.due_at
      || !Number.isFinite(Date.parse(invoice.due_at)) || ![0, 1, 2].includes(step)) throw new Error('Open invoice and due date are required')
    const due = new Intl.DateTimeFormat(es ? 'es-US' : 'en-US', {
      timeZone: context.timezone, month: 'short', day: 'numeric', year: 'numeric',
    }).format(new Date(invoice.due_at))
    const label = String(invoice.invoice_number).replace(/[\r\n]/g, ' ').slice(0, 40)
    const opening = es ? ['un recordatorio', 'le damos seguimiento', 'un último recordatorio'][step]
      : ['a quick reminder', 'just following up', 'one last reminder'][step]
    return es
      ? `${opening} de Monkey Trucking. la factura ${label} por $${amount.toFixed(2)} vence el ${due}. si ya pagó o tiene alguna pregunta, avísenos para revisarlo.`
      : `${opening} from Monkey Trucking. invoice ${label} for $${amount.toFixed(2)} is due ${due}. if you have already paid or have a question, let us know so we can check.`
  }
  if (!job || job.status !== 'COMPLETED' || invoice.status !== 'PAID') throw new Error('Completed work and confirmed payment are required')
  const scope: Record<string, [string, string]> = {
    DRIVEWAY: ['driveway project', 'proyecto de entrada'], POND: ['pond project', 'proyecto de estanque'],
    MATERIAL_DELIVERY: ['material delivery', 'entrega de material'], DIRT_GRADING: ['dirt work project', 'trabajo de tierra'],
  }
  const work = scope[job.category]?.[es ? 1 : 0] ?? (es ? 'trabajo' : 'project')
  if (rule === 'review-request') {
    let url: URL
    try { url = new URL(context.reviewUrl ?? '') } catch { throw new Error('Verified review URL is missing') }
    if (url.protocol !== 'https:' || url.username || url.password) throw new Error('Verified HTTPS review URL is required')
    // Ask everyone eligible, not only happy customers; never invent an outcome.
    return es ? `gracias por confiar en Monkey Trucking con su ${work}. si desea compartir su experiencia, puede dejar una reseña aquí: ${url.href}`
      : `thanks for trusting Monkey Trucking with your ${work}. if you would like to share your experience, you can leave a review here: ${url.href}`
  }
  if (rule === 'reactivation') return es
    ? `hola, somos Monkey Trucking. esperamos que todo siga bien desde su ${work}. si necesita material o tiene otro proyecto, aquí estamos a su servicio. responda STOP para dejar de recibir mensajes.`
    : `hi, this is Monkey Trucking. we hope things are going well since your ${work}. if you need material or have another project in mind, we are here to help. reply STOP to opt out.`
  throw new Error('No verified trigger and response for this automation')
}
