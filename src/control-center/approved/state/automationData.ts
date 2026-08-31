/**
 * The automation matrix.
 *
 * Every rule carries the seven things an automation needs: trigger, conditions,
 * delay, action, stop condition, fallback, and where the result is logged.
 *
 * Nothing here sends anything. No external service is connected in this
 * prototype. These are the definitions Codex implements against, and the states
 * they produce are represented on the real records.
 */

export type AutomationStatus = 'ON' | 'SETUP_REQUIRED' | 'OFF'

export type AutomationRule = {
  id: string
  name: string
  trigger: string
  conditions: string[]
  delay: string
  action: string
  stopConditions: string[]
  fallback: string
  log: string
  status: AutomationStatus
  /** Timing that is deliberately tunable during implementation. */
  tunable: boolean
}

export const AUTOMATIONS: AutomationRule[] = [
  {
    id: 'new-lead',
    name: 'New lead follow up',
    trigger: 'A lead is created from the website, a text, or a tracking link',
    conditions: ['The customer has not opted out', 'No human has taken over yet'],
    delay: 'Immediate reply, then about 4 business hours, next business day, and about 3 days',
    action: 'Ask only for the next missing piece of information, one short message at a time',
    stopConditions: [
      'Customer replies',
      'A human takes over',
      'A quote is sent',
      'Lead is won',
      'Lead is lost',
      'Customer opts out',
    ],
    fallback: 'Delivery failure or AI uncertainty goes to Needs Attention',
    log: 'Message and result on the lead conversation and the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'missed-call',
    name: 'Missed call recovery',
    trigger: 'A business call is missed',
    conditions: ['Caller is not already in an active conversation'],
    delay: 'About 1 to 2 minutes after the missed call',
    action: 'Send a short text offering to help',
    stopConditions: ['Customer calls back', 'Customer replies', 'A human takes over'],
    fallback: 'If the text fails to deliver, create a Needs Attention item to call back',
    log: 'Missed call and the recovery text on the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'quote-follow-up',
    name: 'Quote follow up',
    trigger: 'A quote is sent and the lead becomes Quoted',
    conditions: ['Quote is still open', 'No unresolved complaint', 'Customer has not opted out'],
    delay: 'Next business day, about 3 days, then about 7 days after the quote',
    action: 'A contextual message about that specific quote, never a blind template',
    stopConditions: [
      'Customer replies',
      'Quote accepted',
      'Quote declined',
      'A human takes over',
      'Lead marked lost',
      'Customer opts out',
    ],
    fallback: 'Any negotiation goes straight to Salvador',
    log: 'Each follow up on the quote and the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'human-takeover',
    name: 'Human takeover',
    trigger: 'Salvador or the admin replies in an active conversation',
    conditions: ['There is an AI conversation running on that lead'],
    delay: 'Immediate',
    action: 'Pause the AI on that conversation so it never talks over a person',
    stopConditions: ['Not applicable, this rule only pauses'],
    fallback:
      'Pausing is not permanent. Approved workflows such as quote follow up can become eligible again later',
    log: 'Takeover marked on the conversation',
    status: 'ON',
    tunable: false,
  },
  {
    id: 'job-reminder',
    name: 'Job reminder',
    trigger: 'A job is scheduled with a real work date',
    conditions: ['Job is scheduled and active', 'The current schedule was set more than 24 hours before work', 'SMS consent is recorded', 'Customer has not opted out', 'No reminder is logged for this exact scheduled time'],
    delay: 'About 24 hours before the current scheduled work time',
    action: 'Prepare one SMS reminder with the current date and time',
    stopConditions: [
      'Job cancelled',
      'Job completed early',
      'Job rescheduled, the old schedule is no longer eligible',
      'Customer opts out',
      'Reminder already logged for this scheduled time',
    ],
    fallback: 'A requested time change is acknowledged and handed to Salvador, never moved by AI',
    log: 'Job and customer history with the scheduled time used for duplicate prevention',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'invoice-follow-up',
    name: 'Invoice follow up',
    trigger: 'An invoice is sent',
    conditions: ['Invoice is open', 'Not disputed', 'Customer has not opted out'],
    delay: 'On the due date, about 1 day overdue, and a final reminder about 3 days overdue',
    action: 'A short reminder with the amount and the due date',
    stopConditions: [
      'Payment recorded',
      'Invoice voided',
      'Invoice disputed',
      'Due date changed',
      'A human takes over',
      'Customer opts out',
    ],
    fallback:
      'After the final reminder it becomes a Needs Attention item. A claim of payment never marks anything paid',
    log: 'Every reminder on the invoice and the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'review-request',
    name: 'Review request',
    trigger: 'A job is completed and its invoice is paid',
    conditions: [
      'No unresolved complaint',
      'No active dispute',
      'No review request already sent for that job',
      'Customer has not opted out',
    ],
    delay: 'About 24 hours after payment',
    action: 'One warm message about the outcome, with the review link as the natural last part',
    stopConditions: ['Customer reports a problem', 'Only ever one request per job'],
    fallback: 'A reported problem pauses it and goes to Salvador, who can resume or skip it',
    log: 'Review request state on the job and the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
  {
    id: 'reactivation',
    name: '60 day reactivation',
    trigger: 'About 60 days after completed and paid work',
    conditions: [
      'No active lead',
      'No active quote',
      'No active job',
      'No payment issue',
      'No unresolved complaint',
      'Customer has not opted out',
      'Customer has not already come back',
    ],
    delay: 'About 60 days, once',
    action: 'One warm, no pressure message offering to help again',
    stopConditions: ['This is a single message and never repeats'],
    fallback: 'Any reply moves it into a normal conversation',
    log: 'Reactivation state on the customer timeline',
    status: 'SETUP_REQUIRED',
    tunable: true,
  },
]

/**
 * Sample customer messages, following the locked rules exactly.
 * Lowercase start, short, friendly, no hyphens, no em dashes, and nothing asked
 * twice. English, Spanish and natural Spanglish.
 */
export const AI_SAMPLES: {
  id: string
  language: 'English' | 'Spanish' | 'Spanglish'
  context: string
  text: string
}[] = [
  {
    id: 'sample-1',
    language: 'English',
    context: 'New lead, first reply',
    text: 'hey, we can help you with that. what city is the driveway in so i can check the delivery for you.',
  },
  {
    id: 'sample-2',
    language: 'Spanish',
    context: 'New lead, first reply',
    text: 'claro que sí. como cuántas yardas cree que necesita y en qué parte de kaufman está el rancho.',
  },
  {
    id: 'sample-3',
    language: 'Spanglish',
    context: 'Quote on the way',
    text: 'perfecto, 3 cargas de flexbase. what is the address for the entrance so i can add the delivery.',
  },
  {
    id: 'sample-4',
    language: 'English',
    context: 'Escalation, custom work has no set price',
    text: 'a pond that size is not a set price, salvador puts the number on those himself. i am getting him on this for you.',
  },
  {
    id: 'sample-5',
    language: 'English',
    context: 'Job reminder, 24 hours ahead',
    text: 'quick reminder, we are coming out thursday at 9 for the driveway. anything we should know before we roll in.',
  },
  {
    id: 'sample-6',
    language: 'English',
    context: 'Customer says they paid',
    text: 'thanks for letting us know. salvador will check it on his end and get back to you.',
  },
  {
    id: 'sample-7',
    language: 'English',
    context: 'Review request, about a day after payment',
    text: 'hey, hope the driveway is making getting in and out a lot easier now. we really appreciate you trusting us with the work. if you are happy with how everything came out, here is our google review link if you would like to share your experience.',
  },
  {
    id: 'sample-8',
    language: 'Spanish',
    context: '60 day reactivation, one message only',
    text: 'hola, nomás queríamos ver cómo siguen. si necesitan más material o tienen algún trabajo que necesiten hacer, aquí estamos a sus órdenes. cualquier cosa nos avisan.',
  },
]
