import { useEffect, useRef, useState } from 'react'
import { Camera, Check, ImageUp, LogOut } from 'lucide-react'
import { useAuth, initialsFor } from '@/hooks/useAuth'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import {
  PROFILE_AVATAR_ACCEPT,
  avatarMetadata,
  signedAvatarUrl,
  uploadProfileAvatar,
  validateProfileAvatar,
} from '@/control-center/profile/profileAvatar'
import { PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { cn } from '@/control-center/approved/lib/cn'
import { Sheet } from './Sheet'

const AVATAR_UPDATED_EVENT = 'monkey-trucking:avatar-updated'

export function ProfileAvatarControl({
  className,
  compact = false,
}: {
  className?: string
  compact?: boolean
}) {
  const { user, signOut } = useAuth()
  const demo = useDemoMode()
  const inputRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const metadata = avatarMetadata(user)

  useEffect(() => {
    let active = true
    if (!metadata.path) {
      setAvatarUrl(null)
      return () => { active = false }
    }

    void signedAvatarUrl(metadata.path, metadata.version).then((url) => {
      if (active) setAvatarUrl(url)
    })
    return () => { active = false }
  }, [metadata.path, metadata.version])

  useEffect(() => {
    const receive = (event: Event) => {
      const url = (event as CustomEvent<string>).detail
      if (url) setAvatarUrl(url)
    }
    window.addEventListener(AVATAR_UPDATED_EVENT, receive)
    return () => window.removeEventListener(AVATAR_UPDATED_EVENT, receive)
  }, [])

  const onChoose = async (file: File | undefined) => {
    if (!file || !user || demo.enabled) return
    setError(null)
    setSaved(false)
    const validationError = validateProfileAvatar(file)
    if (validationError) {
      setError(validationError)
      return
    }

    setLoading(true)
    try {
      const url = await uploadProfileAvatar(user, file)
      setAvatarUrl(url)
      setSaved(true)
      window.dispatchEvent(new CustomEvent<string>(AVATAR_UPDATED_EVENT, { detail: url }))
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : 'Profile image upload failed.'
      setError(message)
    } finally {
      setLoading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const fallback = demo.enabled ? 'SA' : initialsFor(user)

  return (
    <>
      <button
        type="button"
        aria-label="Change profile image"
        title="Change profile image"
        onClick={() => {
          setError(null)
          setSaved(false)
          setOpen(true)
        }}
        className={cn(
          'group relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-mt-red font-display uppercase leading-none text-white shadow-[0_10px_24px_-14px_rgba(255,49,49,0.8)] transition-[transform,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice focus-visible:ring-offset-2 focus-visible:ring-offset-canvas motion-safe:hover:-translate-y-0.5 hover:shadow-[0_16px_28px_-15px_rgba(255,49,49,0.9)]',
          compact ? 'h-10 w-10 text-[16px]' : 'h-10 w-10 text-[18px]',
          className,
        )}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="Profile" className="h-full w-full object-cover" />
        ) : (
          fallback
        )}
        <span className="absolute inset-0 hidden items-center justify-center bg-black/55 text-white group-hover:flex group-focus-visible:flex">
          <Camera className="h-4 w-4" aria-hidden="true" strokeWidth={2.4} />
        </span>
      </button>

      <Sheet open={open} onClose={() => !loading && setOpen(false)} eyebrow="Your account" title="Profile image">
        <div className="space-y-5 p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-mt-red font-display text-[32px] uppercase leading-none text-white">
              {avatarUrl ? (
                <img src={avatarUrl} alt="Current profile" className="h-full w-full object-cover" />
              ) : (
                fallback
              )}
            </div>
            <div className="min-w-0">
              <div className="font-label text-[13px] font-semibold uppercase tracking-[0.14em] text-ink">
                Change profile image
              </div>
              <p className="mt-1 text-[14px] leading-relaxed text-cc-muted">
                JPG, PNG or WEBP. Maximum 10 MB. Your image saves as soon as it is selected.
              </p>
            </div>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept={PROFILE_AVATAR_ACCEPT}
            className="sr-only"
            onChange={(event) => void onChoose(event.target.files?.[0])}
          />

          {demo.enabled || !user ? (
            <p className="rounded-xl border border-warn/30 bg-warn/10 px-4 py-3 text-[14px] text-warn">
              Profile uploads use the authenticated account and are unavailable in demo mode.
            </p>
          ) : (
            <PrimaryButton
              fullWidth
              disabled={loading}
              onClick={() => inputRef.current?.click()}
              icon={<ImageUp className="h-5 w-5" strokeWidth={2.2} />}
            >
              {loading ? 'Uploading' : 'Choose image'}
            </PrimaryButton>
          )}

          {loading && (
            <div role="status" aria-live="polite">
              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.07]">
                <div className="h-full w-2/3 animate-pulse-soft rounded-full bg-mt-red" />
              </div>
              <p className="mt-2 text-[13px] text-cc-muted">Validating and securely saving your image…</p>
            </div>
          )}

          {saved && !loading && (
            <div className="flex items-center gap-2 text-[14px] font-semibold text-ok" role="status">
              <Check className="h-4 w-4" strokeWidth={2.5} /> Saved
            </div>
          )}

          {error && (
            <p className="rounded-xl border border-mt-red/35 bg-mt-red/10 px-4 py-3 text-[14px] text-mt-red" role="alert">
              {error}
            </p>
          )}

          <div className="border-t border-white/[0.08] pt-5">
            <SecondaryButton
              fullWidth
              disabled={loading}
              onClick={() => void signOut().then(() => {
                setOpen(false)
              })}
              icon={<LogOut className="h-5 w-5" strokeWidth={2.2} />}
            >
              Log Out
            </SecondaryButton>
          </div>
        </div>
      </Sheet>
    </>
  )
}
