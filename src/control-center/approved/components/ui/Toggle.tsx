import { cn } from '@/control-center/approved/lib/cn'

export function Toggle({label,line,value,onChange,tone='default',disabled=false}: {
  label:string;line?:string;value:boolean;onChange:(value:boolean)=>void;tone?:'default'|'onSolid';disabled?:boolean
}) {
  return <button type="button" role="switch" aria-label={label} aria-checked={value} disabled={disabled}
    onClick={()=>onChange(!value)} className="flex min-h-[44px] w-full items-start justify-between gap-4 py-1 text-left disabled:opacity-50">
    <span className="min-w-0">
      <span className={cn('block font-label text-[14px] font-semibold uppercase tracking-[0.08em]',tone==='onSolid'?'text-canvas':'text-ink')}>{label}</span>
      {line&&<span className={cn('mt-0.5 block text-[14px] leading-snug',tone==='onSolid'?'text-canvas/75':'text-cc-muted')}>{line}</span>}
    </span>
    <span className={cn('relative mt-1 h-7 w-12 shrink-0 rounded-full border transition-colors',value?tone==='onSolid'?'border-canvas bg-canvas':'border-ice bg-ice':tone==='onSolid'?'border-canvas/40 bg-canvas/15':'border-line bg-raised')}>
      <span className={cn('absolute top-1 h-5 w-5 rounded-full transition-all',value?tone==='onSolid'?'left-6 bg-mt-red':'left-6 bg-canvas':tone==='onSolid'?'left-1 bg-canvas/70':'left-1 bg-cc-muted')}/>
    </span>
  </button>
}
