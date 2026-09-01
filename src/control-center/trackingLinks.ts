import type { TrackingLink, TrackingLinkGroup } from '@/control-center/data'

export const UNGROUPED_TRACKING_LINKS = '__ungrouped__'

export function trackingGroupValue(groupId: string | null): string {
  return groupId ?? UNGROUPED_TRACKING_LINKS
}

export function trackingGroupId(value: string): string | null {
  return value === UNGROUPED_TRACKING_LINKS ? null : value
}

export function sortTrackingGroups(groups: TrackingLinkGroup[]): TrackingLinkGroup[] {
  return [...groups].sort((left, right) => left.position - right.position || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
}

export function sortTrackingLinks(links: TrackingLink[]): TrackingLink[] {
  return [...links].sort((left, right) => left.position - right.position || left.created_at.localeCompare(right.created_at) || left.id.localeCompare(right.id))
}

export function trackingLinksInGroup(links: TrackingLink[], groupId: string | null): TrackingLink[] {
  return sortTrackingLinks(links.filter((link) => link.group_id === groupId))
}

export function moveTrackingLinkLocally(
  links: TrackingLink[],
  linkId: string,
  targetGroupId: string | null,
  targetPosition: number,
): TrackingLink[] {
  const moved = links.find((link) => link.id === linkId)
  if (!moved || !moved.is_active) return links

  const sourceGroupId = moved.group_id
  const target = trackingLinksInGroup(
    links.filter((link) => link.is_active && link.id !== linkId),
    targetGroupId,
  )
  const safePosition = Math.min(Math.max(targetPosition, 0), target.length)
  target.splice(safePosition, 0, { ...moved, group_id: targetGroupId })

  const targetPositions = new Map(target.map((link, index) => [link.id, (index + 1) * 1000]))
  const source = sourceGroupId === targetGroupId
    ? []
    : trackingLinksInGroup(
      links.filter((link) => link.is_active && link.id !== linkId),
      sourceGroupId,
    )
  const sourcePositions = new Map(source.map((link, index) => [link.id, (index + 1) * 1000]))

  return links.map((link) => {
    if (targetPositions.has(link.id)) {
      return { ...link, group_id: targetGroupId, position: targetPositions.get(link.id)! }
    }
    if (sourcePositions.has(link.id)) return { ...link, position: sourcePositions.get(link.id)! }
    return link
  })
}

export function reorderTrackingGroupsLocally(groups: TrackingLinkGroup[], orderedIds: string[]): TrackingLinkGroup[] {
  const positions = new Map(orderedIds.map((id, index) => [id, (index + 1) * 1000]))
  return groups.map((group) => positions.has(group.id) ? { ...group, position: positions.get(group.id)! } : group)
}
