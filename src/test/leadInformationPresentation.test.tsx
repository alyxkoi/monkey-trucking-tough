import { render, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { KnownAndMissing } from '@/control-center/approved/components/ui/FactList'

describe('lead information presentation', () => {
  it('separates confirmed details from details still needed', () => {
    render(
      <KnownAndMissing
        known={[
          { label: 'Material', value: '1 inch crushed concrete' },
          { label: 'Quantity', value: '1 truck load' },
        ]}
        missing={['Delivery address', 'Preferred delivery date']}
      />,
    )

    const confirmed = screen.getByRole('region', { name: 'Confirmed' })
    const needed = screen.getByRole('region', { name: 'Still needed' })

    expect(within(confirmed).getByText('2 details collected')).toBeInTheDocument()
    expect(within(confirmed).getByText('1 inch crushed concrete')).toBeInTheDocument()
    expect(within(needed).getByText('2 details outstanding')).toBeInTheDocument()
    expect(within(needed).getByText('Delivery address')).toBeInTheDocument()
  })

  it('shows clear empty states without leaving either group blank', () => {
    render(<KnownAndMissing known={[]} missing={[]} />)

    expect(screen.getByText('No confirmed details yet.')).toBeInTheDocument()
    expect(screen.getByText('No missing details identified yet.')).toBeInTheDocument()
  })

  it('only reports completion after at least one detail has been confirmed', () => {
    render(<KnownAndMissing known={[{ label: 'Material', value: 'Flexbase' }]} missing={[]} />)

    expect(screen.getByText('All needed details collected.')).toBeInTheDocument()
  })
})
