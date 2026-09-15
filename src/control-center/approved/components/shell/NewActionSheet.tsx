import {
  Banknote,
  CalendarPlus,
  MessageSquarePlus,
  Plus,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useAppState } from '@/control-center/approved/state/AppState'
import { Sheet } from './Sheet'

type CreateAction = {
  key: string
  label: string
  line: string
  to: string
  icon: LucideIcon
  /** Acid green for system creation, red for the money-confirming action. */
  tone: 'ice' | 'red'
}

/**
 * Four real starting points, and nothing that is really a consequence of one.
 *
 * The menu answers where the work is, not which table it lands in. Salvador
 * should never have to choose between a lead, a customer and a quote before he
 * has decided anything about the job itself.
 *
 * Customer is gone because every one of these creates the identity record on its
 * own: search for the person, add them inline if they are new, and the same phone
 * and email matching runs underneath so a second record is never made. Quote is
 * gone because a quote is something a lead turns into, not something a day starts
 * with, and it is still created from a lead or an existing opportunity.
 */
const ACTIONS: CreateAction[] = [
  {
    key: 'lead',
    label: 'New Lead',
    line: 'Interested, but the work is not agreed yet.',
    to: '/admin/leads',
    icon: MessageSquarePlus,
    tone: 'ice',
  },
  {
    key: 'job',
    label: 'New Job',
    line: 'Already agreed. Put it straight on the calendar.',
    to: '/admin/jobs',
    icon: CalendarPlus,
    tone: 'ice',
  },
  {
    key: 'ticket',
    label: 'New Ticket',
    line: 'Material going out now, with no job behind it.',
    to: '/admin/tickets/new',
    icon: Ticket,
    tone: 'ice',
  },
  {
    key: 'payment',
    label: 'Record Payment',
    line: 'Money that actually came in on an open invoice.',
    to: '/admin/money?action=record-payment',
    icon: Banknote,
    tone: 'red',
  },
]

/** The single + New entry point. Desktop button and mobile action button both open this. */
export function NewActionSheet() {
  const { newSheetOpen, setNewSheetOpen, setNewLeadSheetOpen, setNewJobSheetOpen } =
    useAppState()
  const navigate = useNavigate()
  const reduced = useReducedMotion()
  const [mobile,setMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches)
  const menuRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const media=window.matchMedia('(max-width: 1023px)')
    const change=()=>setMobile(media.matches)
    media.addEventListener('change',change)
    return()=>media.removeEventListener('change',change)
  },[])
  useEffect(()=>{
    if(!newSheetOpen||!mobile)return
    const previous=document.activeElement as HTMLElement|null
    const overflow=document.body.style.overflow
    document.body.style.overflow='hidden'
    menuRef.current?.querySelector('button')?.focus()
    const onKey=(e:KeyboardEvent)=>{
      if(e.key==='Escape'){e.preventDefault();setNewSheetOpen(false)}
      if(e.key==='Tab'){
        const buttons=Array.from(menuRef.current?.querySelectorAll('button')??[])
        const i=buttons.indexOf(document.activeElement as HTMLButtonElement)
        e.preventDefault();buttons[(i+(e.shiftKey?-1:1)+buttons.length)%buttons.length]?.focus()
      }
    }
    window.addEventListener('keydown',onKey)
    return()=>{document.body.style.overflow=overflow;window.removeEventListener('keydown',onKey);previous?.focus()}
  },[newSheetOpen,mobile,setNewSheetOpen])

  const go = (action: CreateAction) => {
    setNewSheetOpen(false)
    if (action.key === 'lead') {
      setNewLeadSheetOpen(true)
      return
    }
    // Work that is already agreed goes straight onto the calendar. No lead, no
    // quote, and the customer can be created inside the sheet.
    if (action.key === 'job') {
      setNewJobSheetOpen(true)
      return
    }
    navigate(action.to)
  }

  if (mobile) return createPortal(
    <AnimatePresence>{newSheetOpen && <motion.div key="new-actions" className="cc-sheet-portal fixed inset-0 z-[60] font-control-body text-ink" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:reduced?0:0.15}}>
      <button type="button" tabIndex={-1} aria-label="Dismiss new actions" className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={()=>setNewSheetOpen(false)}/>
      <div ref={menuRef} role="dialog" aria-modal="true" aria-label="New action" className="absolute right-4 flex max-w-[calc(100vw-32px)] flex-col items-end gap-3" style={{bottom:'calc(env(safe-area-inset-bottom, 0px) + 150px)'}}>
        {ACTIONS.map((action,i)=><motion.button key={action.key} type="button" onClick={()=>go(action)} initial={{opacity:0,y:reduced?0:20,scale:reduced?1:0.95}} animate={{opacity:1,y:0,scale:1}} exit={{opacity:0,y:reduced?0:12}} transition={reduced?{duration:0}:{type:'spring',stiffness:440,damping:30,delay:(3-i)*0.035}} className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/15 bg-panel px-4 py-3 shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-ice">
          <span className="text-[15px] font-semibold">{action.label}</span><span className={action.tone==='red'?'text-mt-red':'text-ice'}><action.icon className="h-5 w-5"/></span>
        </motion.button>)}
        <button type="button" aria-label="Close new actions" onClick={()=>setNewSheetOpen(false)} className="absolute -bottom-[70px] right-0 flex h-14 w-14 items-center justify-center rounded-2xl bg-mt-red text-white shadow-xl"><motion.span initial={{rotate:0}} animate={{rotate:45}} transition={{duration:reduced?0:0.2}}><Plus className="h-7 w-7" strokeWidth={2.6}/></motion.span></button>
      </div>
    </motion.div>}</AnimatePresence>,document.body,
  )

  return (
    <Sheet
      open={newSheetOpen}
      onClose={() => setNewSheetOpen(false)}
      eyebrow="Create"
      title="What are we making?"
      footer={
        <p className="text-[13px] leading-snug text-cc-muted">
          A lead is work you are still trying to win. If they have already said yes,
          go straight to a job. A quote is created from a lead when one is needed.
        </p>
      }
    >
      <div className="divide-y divide-line">
        {ACTIONS.map((action) => (
          <button
            key={action.key}
            type="button"
            onClick={() => go(action)}
            className="row-hover flex w-full items-center gap-4 px-5 py-4 text-left hover:bg-white/[0.04] active:bg-raised"
          >
            <span
              className={
                action.tone === 'red'
                  ? 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-mt-red text-white'
                  : 'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-line bg-raised text-ice'
              }
            >
              <action.icon className="h-5 w-5" strokeWidth={2} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block font-label text-[15px] font-semibold uppercase tracking-[0.08em] text-ink">
                {action.label}
              </span>
              <span className="mt-0.5 block text-[14px] text-cc-muted">{action.line}</span>
            </span>
          </button>
        ))}
      </div>
    </Sheet>
  )
}
