// @vitest-environment node
import { describe, expect, it } from 'vitest'
import type { TrackingLink, TrackingLinkGroup } from '@/control-center/data'
import { moveTrackingLinkLocally, reorderTrackingGroupsLocally, sortTrackingGroups, trackingLinksInGroup } from '@/control-center/trackingLinks'

const link = (id: string, group_id: string | null, position: number, is_active = true): TrackingLink => ({
  id,
  group_id,
  position,
  is_active,
  source: 'Website',
  campaign: id,
  destination: 'https://monkeytrucking.llc',
  slug: id,
  visits: 0,
  leads: 0,
  customers: 0,
  archived_at: null,
  archived_by: null,
  created_by: null,
  created_at: `2026-09-01T00:00:0${position / 1000}.000Z`,
})

describe('tracking link organization', () => {
  it('moves an active link across groups and renumbers both lists', () => {
    const result = moveTrackingLinkLocally([
      link('a', 'one', 1000),
      link('b', 'one', 2000),
      link('c', 'two', 1000),
    ], 'b', 'two', 0)

    expect(trackingLinksInGroup(result, 'one').map((item) => [item.id, item.position])).toEqual([['a', 1000]])
    expect(trackingLinksInGroup(result, 'two').map((item) => [item.id, item.position])).toEqual([['b', 1000], ['c', 2000]])
  })

  it('does not move an archived link', () => {
    const original = [link('archived', 'one', 1000, false)]
    expect(moveTrackingLinkLocally(original, 'archived', 'two', 0)).toBe(original)
  })

  it('persists an explicit group order with stable positions', () => {
    const groups: TrackingLinkGroup[] = [
      { id: 'one', name: 'One', position: 1000, created_by: null, created_at: '2026-09-01', updated_at: '2026-09-01' },
      { id: 'two', name: 'Two', position: 2000, created_by: null, created_at: '2026-09-01', updated_at: '2026-09-01' },
    ]
    const reordered = sortTrackingGroups(reorderTrackingGroupsLocally(groups, ['two', 'one']))
    expect(reordered.map((group) => [group.id, group.position])).toEqual([['two', 1000], ['one', 2000]])
  })
})
