import type { User } from '@supabase/supabase-js'
import { supabase } from '@/integrations/supabase/client'

export const PROFILE_AVATAR_BUCKET = 'user-avatars'
export const PROFILE_AVATAR_MAX_BYTES = 10 * 1024 * 1024
export const PROFILE_AVATAR_ACCEPT = 'image/jpeg,image/png,image/webp'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function validateProfileAvatar(file: Pick<File, 'size' | 'type'>): string | null {
  if (!ALLOWED_TYPES.has(file.type)) return 'Choose a JPG, PNG or WEBP image.'
  if (file.size > PROFILE_AVATAR_MAX_BYTES) return 'Profile images must be 10 MB or smaller.'
  return null
}

export function avatarPathFor(userId: string): string {
  return `${userId}/avatar`
}

export function avatarMetadata(user: User | null): { path: string | null; version: string } {
  const path = typeof user?.user_metadata?.avatar_path === 'string'
    ? user.user_metadata.avatar_path
    : null
  const versionValue = user?.user_metadata?.avatar_version
  return { path, version: versionValue == null ? '' : String(versionValue) }
}

export async function signedAvatarUrl(path: string, version = ''): Promise<string | null> {
  const { data, error } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .createSignedUrl(path, 60 * 60)

  if (error || !data?.signedUrl) return null
  const separator = data.signedUrl.includes('?') ? '&' : '?'
  return `${data.signedUrl}${separator}v=${encodeURIComponent(version)}`
}

export async function uploadProfileAvatar(user: User, file: File): Promise<string> {
  const validationError = validateProfileAvatar(file)
  if (validationError) throw new Error(validationError)

  const path = avatarPathFor(user.id)
  const version = Date.now().toString()
  const { error: uploadError } = await supabase.storage
    .from(PROFILE_AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      contentType: file.type,
      upsert: true,
    })

  if (uploadError) throw new Error(uploadError.message)

  const { error: metadataError } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      avatar_path: path,
      avatar_version: version,
    },
  })

  if (metadataError) throw new Error(metadataError.message)

  const url = await signedAvatarUrl(path, version)
  if (!url) throw new Error('The image was saved, but its preview could not be refreshed.')
  return url
}
