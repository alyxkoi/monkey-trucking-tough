import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ProfileAvatarControl } from '@/control-center/approved/components/shell/ProfileAvatar'

const upload = vi.hoisted(() => vi.fn(async () => 'https://example.test/avatar?v=2'))

vi.mock('@/hooks/useAuth', () => ({
  initialsFor: () => 'AL',
  useAuth: () => ({
    user: {
      id: 'user-123',
      email: 'alex@example.test',
      user_metadata: { full_name: 'Alex Lab' },
    },
  }),
}))

vi.mock('@/control-center/demo/DemoMode', () => ({
  useDemoMode: () => ({ enabled: false }),
}))

vi.mock('@/control-center/profile/profileAvatar', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/control-center/profile/profileAvatar')>()
  return {
    ...actual,
    signedAvatarUrl: vi.fn(async () => null),
    uploadProfileAvatar: upload,
  }
})

afterEach(() => {
  upload.mockClear()
  document.body.style.overflow = ''
})

describe('ProfileAvatarControl', () => {
  it('rejects an unsupported image clearly without uploading', async () => {
    render(<ProfileAvatarControl />)
    fireEvent.click(screen.getByRole('button', { name: 'Change profile image' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')
    expect(input).not.toBeNull()

    fireEvent.change(input!, { target: { files: [new File(['gif'], 'avatar.gif', { type: 'image/gif' })] } })

    expect(await screen.findByRole('alert')).toHaveTextContent('Choose a JPG, PNG or WEBP image.')
    expect(upload).not.toHaveBeenCalled()
  })

  it('uploads a valid image immediately and confirms it was saved', async () => {
    render(<ProfileAvatarControl />)
    fireEvent.click(screen.getByRole('button', { name: 'Change profile image' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')

    fireEvent.change(input!, { target: { files: [new File(['png'], 'avatar.png', { type: 'image/png' })] } })

    await waitFor(() => expect(upload).toHaveBeenCalledTimes(1))
    expect(await screen.findByText('Saved')).toBeInTheDocument()
    expect(screen.getByAltText('Current profile')).toHaveAttribute('src', 'https://example.test/avatar?v=2')
  })

  it('refreshes immediately when a second image replaces the first', async () => {
    upload
      .mockResolvedValueOnce('https://example.test/avatar?v=first')
      .mockResolvedValueOnce('https://example.test/avatar?v=second')
    render(<ProfileAvatarControl />)
    fireEvent.click(screen.getByRole('button', { name: 'Change profile image' }))
    const input = document.querySelector<HTMLInputElement>('input[type="file"]')!

    fireEvent.change(input, { target: { files: [new File(['one'], 'one.jpg', { type: 'image/jpeg' })] } })
    await waitFor(() => expect(screen.getByAltText('Current profile')).toHaveAttribute('src', 'https://example.test/avatar?v=first'))

    fireEvent.change(input, { target: { files: [new File(['two'], 'two.webp', { type: 'image/webp' })] } })
    await waitFor(() => expect(screen.getByAltText('Current profile')).toHaveAttribute('src', 'https://example.test/avatar?v=second'))
    expect(upload).toHaveBeenCalledTimes(2)
  })
})
