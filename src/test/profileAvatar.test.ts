import { describe, expect, it, vi } from 'vitest'

vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }))

import {
  PROFILE_AVATAR_MAX_BYTES,
  avatarPathFor,
  validateProfileAvatar,
} from '@/control-center/profile/profileAvatar'

describe('profile avatar validation', () => {
  it.each(['image/jpeg', 'image/png', 'image/webp'])('accepts %s at the size limit', (type) => {
    expect(validateProfileAvatar({ type, size: PROFILE_AVATAR_MAX_BYTES })).toBeNull()
  })

  it('rejects unsupported image formats', () => {
    expect(validateProfileAvatar({ type: 'image/gif', size: 1024 })).toMatch(/JPG, PNG or WEBP/)
  })

  it('rejects images over 10 MB', () => {
    expect(validateProfileAvatar({ type: 'image/png', size: PROFILE_AVATAR_MAX_BYTES + 1 })).toMatch(/10 MB/)
  })

  it('uses one stable object per authenticated user', () => {
    expect(avatarPathFor('user-123')).toBe('user-123/avatar')
  })
})
