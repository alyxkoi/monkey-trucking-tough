import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'
import { cn } from '@/control-center/approved/lib/cn'
import { PrimaryButton } from './Button'
import { SolidInfoModule } from './SolidInfoModule'
import { StatusPill } from './StatusPill'
import type { Message } from '@/control-center/approved/state/salesData'

function clockLabel(at: number): string {
  return new Date(at)
    .toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    .toUpperCase()
}

function dayLabel(at: number): string {
  const date = new Date(at)
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  if (sameDay) return 'TODAY'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

/**
 * One message.
 *
 * Customer sits on the left, everything Monkey Trucking sends sits on the right,
 * and the role is carried by a solid fill so it is readable at a glance without
 * reading the label: neutral for the customer, blue for the AI, green for a
 * human reply. Solid rather than tinted, because a half transparent bubble over
 * a textured background is harder to read and tells you less.
 *
 * Green is used here as a role marker for a human reply. Everywhere else in the
 * product green still means settled money and nothing else.
 */
export function ConversationMessage({ message }: { message: Message }) {
  if (message.actor === 'system') {
    return (
      <div className="py-2 text-center font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-idle">
        {message.text}
      </div>
    )
  }

  const incoming = message.actor === 'customer'
  const label = message.actor === 'ai' ? 'AI' : incoming ? 'Customer' : 'Salvador'

  return (
    <div className={cn('flex', incoming ? 'justify-start' : 'justify-end')}>
      <div className={cn('max-w-[85%] sm:max-w-[76%]', incoming ? 'items-start' : 'items-end')}>
        <div
          className={cn(
            'mb-1.5 flex items-center gap-2',
            incoming ? 'justify-start' : 'justify-end',
          )}
        >
          <span
            className={cn(
              'font-label text-[12px] font-semibold uppercase tracking-[0.14em]',
              message.actor === 'ai'
                ? 'text-ice'
                : message.actor === 'salvador'
                  ? 'text-ok'
                  : 'text-cc-muted',
            )}
          >
            {label}
          </span>
          <span className="font-label text-[12px] uppercase tracking-[0.1em] text-idle">
            {dayLabel(message.at)} {clockLabel(message.at)}
          </span>
        </div>

        <div
          className={cn(
            'rounded-xl px-4 py-3 text-[15px] leading-relaxed',
            incoming && 'border border-white/10 bg-raised text-ink',
            message.actor === 'ai' && 'bg-ice-violet font-medium text-white',
            message.actor === 'salvador' && 'bg-ok font-medium text-canvas',
          )}
        >
          {message.text}
        </div>

        {message.escalation && (
          <div className={cn('mt-2 flex', incoming ? 'justify-start' : 'justify-end')}>
            <StatusPill tone="now" size="sm">
              Handed to Salvador
            </StatusPill>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The thread.
 *
 * A fixed height scroll region rather than a list that grows forever. A long
 * history used to push the reply box off the bottom of the screen and leave a
 * column of dead space beside it. This shows roughly the last four messages,
 * opens at the newest, and scrolls inside itself, so the composer is always
 * where you left it.
 */
export function ConversationThread({
  messages,
  className,
}: {
  messages: Message[]
  className?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  // Open on the newest message, and stay there when a reply is sent.
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  return (
    <div
      ref={ref}
      className={cn(
        // A ceiling rather than a fixed height. A long thread stops at about four
        // messages and scrolls inside itself, and a two message thread does not
        // hold open an empty box underneath it.
        'max-h-[340px] overflow-y-auto overscroll-contain sm:max-h-[400px] lg:max-h-[440px]',
        className,
      )}
    >
      <div className="space-y-4 p-4 sm:p-5">
        {messages.map((message) => (
          <ConversationMessage key={message.id} message={message} />
        ))}
      </div>
    </div>
  )
}

/** The one banner that has to be impossible to miss. */
export function SalvadorNeeded({ line }: { line: string }) {
  return (
    <SolidInfoModule tone="red">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="font-label text-[13px] font-semibold uppercase tracking-[0.18em] text-canvas/70">
            Salvador Needed
          </div>
          <p className="mt-1.5 max-w-[52ch] text-[17px] font-bold leading-snug">{line}</p>
        </div>
      </div>
    </SolidInfoModule>
  )
}

/**
 * Reply composer. Sending a reply is a human takeover: it pauses the active AI
 * conversation on this lead immediately.
 */
export function ReplyComposer({
  onSend,
  paused,
  disabled = false,
}: {
  onSend: (text: string) => void
  paused: boolean
  disabled?: boolean
}) {
  const [text, setText] = useState('')

  const send = () => {
    if (!text.trim()) return
    onSend(text)
    setText('')
  }

  return (
    <div className="border-t border-line p-4">
      {disabled ? (
        <div className="mb-3 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-warn">
          SMS setup required before replies can be sent
        </div>
      ) : paused && (
        <div className="mb-3 font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-cc-muted">
          AI paused, you are handling this conversation
        </div>
      )}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-end">
        <textarea
          value={text}
          disabled={disabled}
          rows={2}
          placeholder={disabled ? 'Connect SMS in Settings to reply' : 'Write a reply'}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) send()
          }}
          className="w-full resize-y rounded-xl border border-line bg-raised px-4 py-3 text-[16px] leading-relaxed text-ink placeholder:text-cc-muted transition-colors focus:border-ice/60 focus:outline-none"
        />
        <PrimaryButton
          onClick={send}
          disabled={disabled || !text.trim()}
          className="shrink-0"
          icon={<Send className="h-4 w-4" strokeWidth={2.4} />}
        >
          Send
        </PrimaryButton>
      </div>
    </div>
  )
}
