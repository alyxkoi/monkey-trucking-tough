type CommunicationKick = {
  jobId?: string | null
  messageId?: string | null
}

declare const EdgeRuntime: {
  waitUntil(promise: Promise<unknown>): void
}

/**
 * Starts the durable communications worker without holding open the public
 * request or provider webhook. The fast cron remains the retry fallback.
 */
export function kickCommunications(url: string, serviceKey: string, input: CommunicationKick) {
  // Background only: webhook acknowledgement and inbound storage are immediate.
  // Match the database's 3-second quiet period; cron retains durable recovery.
  const task = (input.jobId ? new Promise<void>(resolve => setTimeout(resolve, 3100)) : Promise.resolve()).then(() => fetch(`${url.replace(/\/$/, '')}/functions/v1/process-communications`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serviceKey}`,
      apikey: serviceKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
    signal: AbortSignal.timeout(90_000),
  })).then(async (response) => {
    if (!response.ok) {
      const detail = await response.text().catch(() => '')
      console.error('Immediate communications processing failed; cron will retry.', response.status, detail.slice(0, 300))
    }
  }).catch((error) => {
    console.error('Immediate communications processing could not start; cron will retry.', error)
  })

  EdgeRuntime.waitUntil(task)
}
