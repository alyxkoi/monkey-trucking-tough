import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  closestCenter,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  Archive,
  ArrowDown,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  Copy,
  Folder,
  FolderPlus,
  GripVertical,
  Link2,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { PrimaryButton, SecondaryButton } from '@/control-center/approved/components/ui/Button'
import { RecordHeader } from '@/control-center/approved/components/ui/RecordHeader'
import { SelectField, TextField } from '@/control-center/approved/components/ui/Field'
import { Panel } from '@/control-center/approved/components/ui/Panel'
import { SegmentControl } from '@/control-center/approved/components/ui/SegmentControl'
import { StatusPill } from '@/control-center/approved/components/ui/StatusPill'
import { cn } from '@/control-center/approved/lib/cn'
import { useAppState } from '@/control-center/approved/state/AppState'
import { LINK_SOURCES } from '@/control-center/approved/state/settingsData'
import {
  createTrackingLink,
  createTrackingLinkGroup,
  deleteTrackingLinkGroup,
  deleteTrackingLinkIfUnused,
  moveTrackingLink,
  renameTrackingLinkGroup,
  reorderTrackingLinkGroups,
  setTrackingLinkArchived,
  type TrackingLink,
  type TrackingLinkGroup,
} from '@/control-center/data'
import { useControlCenter } from '@/control-center/context'
import { QA_FIXTURE_USER_ID } from '@/control-center/demo/constants'
import { useDemoMode } from '@/control-center/demo/DemoMode'
import { deriveSettingsReadiness, readinessTone, type ReadinessItem } from '@/control-center/readiness'
import {
  moveTrackingLinkLocally,
  reorderTrackingGroupsLocally,
  sortTrackingGroups,
  sortTrackingLinks,
  trackingGroupId,
  trackingGroupValue,
  trackingLinksInGroup,
  UNGROUPED_TRACKING_LINKS,
} from '@/control-center/trackingLinks'
import { trackingRedirectUrl } from '@/lib/trackingAttribution'

const groupDragId = (id: string) => `group:${id}`
const linkDragId = (id: string) => `link:${id}`
const fromDragId = (id: string | number) => String(id).split(':').slice(1).join(':')

function ReadinessNotice({ state }: { state: ReadinessItem }) {
  if (state.status === 'READY') return null
  return (
    <div className={cn(
      'rounded-panel border p-4 sm:p-5',
      state.status === 'ERROR'
        ? 'border-mt-red/40 bg-mt-red/10'
        : state.status === 'WAITING'
          ? 'border-ice/35 bg-ice/[0.08]'
          : 'border-warn/40 bg-warn/10',
    )}>
      <StatusPill tone={readinessTone(state.status)} size="sm">{state.label}</StatusPill>
      <p className="mt-2 text-[14px] leading-snug text-ink/85">{state.reason}</p>
      {state.actions.length > 0 && (
        <ul className="mt-3 space-y-1.5 text-[13px] leading-snug text-cc-muted">
          {state.actions.map((action) => <li key={action}>• {action}</li>)}
        </ul>
      )}
    </div>
  )
}

function trackingSourceStyle(source: string) {
  if (source === 'Facebook') return 'bg-[#1877F2]'
  if (source === 'Website') return 'bg-mt-red text-white'
  if (source === 'QR code') return 'bg-[#6D28D9]'
  return 'bg-[#B7791F] text-canvas'
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <span>
      <span className="block font-display display-tight tnum text-[22px]">{value}</span>
      <span className="block font-label text-[11px] uppercase tracking-[0.1em] text-idle">{label}</span>
    </span>
  )
}

type LinkRowProps = {
  link: TrackingLink
  groups: TrackingLinkGroup[]
  groupLinks: TrackingLink[]
  integrationReady: boolean
  working: boolean
  copied: boolean
  canOrganize: boolean
  onCopy: (link: TrackingLink) => void
  onArchive: (link: TrackingLink, archived: boolean) => void
  onDelete: (link: TrackingLink) => void
  onMove: (link: TrackingLink, groupId: string | null, position: number) => void
}

function TrackingLinkRow({
  link,
  groups,
  groupLinks,
  integrationReady,
  working,
  copied,
  canOrganize,
  onCopy,
  onArchive,
  onDelete,
  onMove,
}: LinkRowProps) {
  const sortable = useSortable({
    id: linkDragId(link.id),
    data: { type: 'link', groupId: trackingGroupValue(link.group_id) },
    disabled: !canOrganize || working,
  })
  const index = groupLinks.findIndex((item) => item.id === link.id)
  const protectedHistory = link.visits > 0 || link.leads > 0 || link.customers > 0
  const style: CSSProperties = {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.35 : undefined,
  }

  return (
    <div
      ref={sortable.setNodeRef}
      style={style}
      className={cn('px-4 py-4 sm:px-5 motion-reduce:transition-none', !link.is_active && 'opacity-70')}
    >
      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(280px,1fr)_auto_auto] xl:items-center">
        <div className="flex min-w-0 items-center gap-2 sm:gap-3.5">
          {canOrganize && (
            <button
              type="button"
              ref={sortable.setActivatorNodeRef}
              {...sortable.attributes}
              {...sortable.listeners}
              disabled={working}
              aria-label={`Drag ${link.campaign}`}
              title="Drag to reorder or move"
              className="flex h-11 w-8 shrink-0 touch-none items-center justify-center rounded-lg text-idle transition-colors hover:bg-white/[0.06] hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-30"
            >
              <GripVertical className="h-5 w-5" />
            </button>
          )}
          <span className={cn('flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.2)]', trackingSourceStyle(link.source))}>
            <Link2 className="h-5 w-5" strokeWidth={2.5} />
          </span>
          <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
              <span className="font-label text-[12px] font-semibold uppercase tracking-[0.12em] text-cc-muted">{link.source}</span>
              {!link.is_active && <StatusPill tone="idle" size="sm">Archived</StatusPill>}
            </div>
            <div className="truncate text-[16px] font-semibold text-ink" title={link.campaign}>{link.campaign}</div>
            <div className="mt-0.5 truncate text-[12px] text-cc-muted" title={trackingRedirectUrl(link.slug)}>{trackingRedirectUrl(link.slug)}</div>
          </div>
        </div>

        <div className="flex items-center gap-5 sm:gap-7">
          <Metric label="Visits" value={link.visits} />
          <Metric label="Leads" value={link.leads} />
          <Metric label="Customers" value={link.customers} />
        </div>

        <div className="flex flex-wrap items-center gap-2 xl:justify-end">
          {canOrganize && (
            <>
              <label>
                <span className="sr-only">Move {link.campaign} to group</span>
                <select
                  value={trackingGroupValue(link.group_id)}
                  onChange={(event) => {
                    const nextGroupId = trackingGroupId(event.target.value)
                    onMove(link, nextGroupId, 1_000_000)
                  }}
                  disabled={working}
                  className="h-11 max-w-[170px] rounded-xl border border-line bg-raised px-3 text-[13px] text-ink focus:border-ice/60 focus:outline-none disabled:opacity-40"
                >
                  <option value={UNGROUPED_TRACKING_LINKS}>Ungrouped</option>
                  {sortTrackingGroups(groups).map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
                </select>
              </label>
              <button
                type="button"
                onClick={() => onMove(link, link.group_id, index - 1)}
                disabled={working || index <= 0}
                aria-label={`Move ${link.campaign} up`}
                title="Move up"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-cc-muted transition-colors hover:border-ice/35 hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-30"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={() => onMove(link, link.group_id, index + 1)}
                disabled={working || index < 0 || index >= groupLinks.length - 1}
                aria-label={`Move ${link.campaign} down`}
                title="Move down"
                className="flex h-11 w-11 items-center justify-center rounded-xl border border-line bg-raised text-cc-muted transition-colors hover:border-ice/35 hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-30"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            </>
          )}
          <SecondaryButton
            size="sm"
            disabled={!integrationReady}
            onClick={() => onCopy(link)}
            icon={copied ? <Check className="h-4 w-4" strokeWidth={2.6} /> : <Copy className="h-4 w-4" strokeWidth={2.2} />}
          >
            {copied ? 'Copied' : 'Copy Link'}
          </SecondaryButton>
          {link.is_active ? (
            <SecondaryButton size="sm" disabled={!integrationReady || working} onClick={() => onArchive(link, true)} icon={<Archive className="h-4 w-4" />}>Archive</SecondaryButton>
          ) : (
            <SecondaryButton size="sm" disabled={!integrationReady || working} onClick={() => onArchive(link, false)} icon={<RotateCcw className="h-4 w-4" />}>Reactivate</SecondaryButton>
          )}
          {!protectedHistory && (
            <SecondaryButton size="sm" disabled={!integrationReady || working} onClick={() => onDelete(link)} icon={<Trash2 className="h-4 w-4" />}>Delete</SecondaryButton>
          )}
        </div>
      </div>
    </div>
  )
}

type GroupCardProps = {
  group: TrackingLinkGroup | null
  links: TrackingLink[]
  groups: TrackingLinkGroup[]
  collapsed: boolean
  canOrganize: boolean
  integrationReady: boolean
  workingId: string | null
  copiedId: string | null
  onToggle: () => void
  onRename: (group: TrackingLinkGroup) => void
  onDeleteGroup: (group: TrackingLinkGroup) => void
  onCopy: LinkRowProps['onCopy']
  onArchive: LinkRowProps['onArchive']
  onDeleteLink: LinkRowProps['onDelete']
  onMove: LinkRowProps['onMove']
}

function TrackingGroupCard({
  group,
  links,
  groups,
  collapsed,
  canOrganize,
  integrationReady,
  workingId,
  copiedId,
  onToggle,
  onRename,
  onDeleteGroup,
  onCopy,
  onArchive,
  onDeleteLink,
  onMove,
}: GroupCardProps) {
  const value = trackingGroupValue(group?.id ?? null)
  const sortable = useSortable({ id: group ? groupDragId(group.id) : `disabled-group:${value}`, data: { type: 'group', groupId: value }, disabled: !canOrganize || !group || workingId !== null })
  const ungroupedDrop = useDroppable({ id: `container:${value}`, data: { type: 'group', groupId: value }, disabled: !canOrganize || Boolean(group) })
  const setNodeRef = group ? sortable.setNodeRef : ungroupedDrop.setNodeRef
  const style: CSSProperties | undefined = group ? {
    transform: CSS.Transform.toString(sortable.transform),
    transition: sortable.transition,
    opacity: sortable.isDragging ? 0.4 : undefined,
  } : undefined

  return (
    <section ref={setNodeRef} style={style} className="overflow-hidden rounded-panel border border-line bg-panel shadow-panel motion-reduce:transition-none">
      <div className={cn('flex min-h-14 items-center gap-1 border-b border-line px-2 sm:px-3', ungroupedDrop.isOver && 'bg-ice/10')}>
        {canOrganize && group && (
          <button
            type="button"
            ref={sortable.setActivatorNodeRef}
            {...sortable.attributes}
            {...sortable.listeners}
            disabled={workingId !== null}
            aria-label={`Drag group ${group.name}`}
            title="Drag to reorder group"
            className="flex h-11 w-9 shrink-0 touch-none items-center justify-center rounded-lg text-idle transition-colors hover:bg-white/[0.06] hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-30"
          >
            <GripVertical className="h-5 w-5" />
          </button>
        )}
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={!collapsed}
          aria-label={`${collapsed ? 'Expand' : 'Collapse'} ${group?.name ?? 'Ungrouped'}`}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-cc-muted transition-colors hover:bg-white/[0.06] hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice"
        >
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        <Folder className="h-4 w-4 shrink-0 text-ice" />
        <div className="min-w-0 flex-1 px-2">
          <div className="truncate text-[15px] font-semibold text-ink">{group?.name ?? 'Ungrouped'}</div>
          <div className="text-[12px] text-cc-muted">{links.length} {links.length === 1 ? 'link' : 'links'}</div>
        </div>
        {group && (
          <>
            <button
              type="button"
              onClick={() => onRename(group)}
              disabled={workingId === `group:${group.id}`}
              aria-label={`Rename ${group.name}`}
              title="Rename group"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-cc-muted transition-colors hover:bg-white/[0.06] hover:text-ice focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ice disabled:opacity-40"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteGroup(group)}
              disabled={workingId === `group:${group.id}`}
              aria-label={`Delete ${group.name}`}
              title="Delete group"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-cc-muted transition-colors hover:bg-mt-red/10 hover:text-mt-red focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mt-red disabled:opacity-40"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
      </div>

      {!collapsed && (
        <SortableContext items={links.map((link) => linkDragId(link.id))} strategy={verticalListSortingStrategy}>
          <div className="divide-y divide-line">
            {links.map((link) => (
              <TrackingLinkRow
                key={link.id}
                link={link}
                groups={groups}
                groupLinks={links}
                integrationReady={integrationReady}
                working={workingId !== null}
                copied={copiedId === link.id}
                canOrganize={canOrganize}
                onCopy={onCopy}
                onArchive={onArchive}
                onDelete={onDeleteLink}
                onMove={onMove}
              />
            ))}
            {links.length === 0 && <div className="px-5 py-7 text-[14px] text-cc-muted">No links here. Move or drag a link into this group.</div>}
          </div>
        </SortableContext>
      )}
    </section>
  )
}

export function SettingsTracking() {
  const navigate = useNavigate()
  const { sourceData } = useAppState()
  const { refresh } = useControlCenter()
  const demo = useDemoMode()
  const [source, setSource] = useState(LINK_SOURCES[0])
  const [campaign, setCampaign] = useState('')
  const [destination, setDestination] = useState('https://monkeytrucking.llc/contact')
  const [selectedGroup, setSelectedGroup] = useState(UNGROUPED_TRACKING_LINKS)
  const [view, setView] = useState<'ACTIVE' | 'ARCHIVED'>('ACTIVE')
  const [groups, setGroups] = useState<TrackingLinkGroup[]>([])
  const [links, setLinks] = useState<TrackingLink[]>([])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [creatingGroup, setCreatingGroup] = useState(false)
  const [newGroupName, setNewGroupName] = useState('')
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [activeDragLabel, setActiveDragLabel] = useState<string | null>(null)

  useEffect(() => { setGroups(sortTrackingGroups(sourceData?.trackingLinkGroups ?? [])) }, [sourceData?.trackingLinkGroups])
  useEffect(() => { setLinks(sortTrackingLinks(sourceData?.trackingLinks ?? [])) }, [sourceData?.trackingLinks])

  const readiness = deriveSettingsReadiness(sourceData ?? null)
  const integrationReady = demo.enabled || sourceData?.trackingIntegration.status === 'READY'
  const slug = (value: string) => value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const preview = trackingRedirectUrl(`${slug(campaign || 'campaign')}-xxxxxx`)
  const visibleLinks = links.filter((link) => view === 'ACTIVE' ? link.is_active : !link.is_active)
  const orderedGroups = sortTrackingGroups(groups)
  const canOrganize = view === 'ACTIVE' && integrationReady
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  )

  const groupCards = useMemo(() => {
    const realGroups = view === 'ACTIVE'
      ? orderedGroups
      : orderedGroups.filter((group) => visibleLinks.some((link) => link.group_id === group.id))
    const hasUngrouped = view === 'ACTIVE' || visibleLinks.some((link) => link.group_id === null)
    return [...realGroups.map((group) => ({ group })), ...(hasUngrouped ? [{ group: null }] : [])]
  }, [orderedGroups, view, visibleLinks])

  const generate = async () => {
    if (!campaign.trim()) return void toast.error('Campaign is required.')
    if (!integrationReady) return void toast.error('Tracking deployment is required before creating tracked links.')
    let safeDestination: string
    try {
      const value = /^https?:\/\//i.test(destination.trim()) ? destination.trim() : `https://${destination.trim()}`
      const parsed = new URL(value)
      if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error()
      safeDestination = parsed.toString()
    } catch {
      return void toast.error('Enter a valid public destination URL.')
    }

    setSaving(true)
    try {
      const groupId = trackingGroupId(selectedGroup)
      if (demo.enabled) {
        const now = new Date().toISOString()
        const uniqueSlug = `${slug(campaign)}-${crypto.randomUUID().slice(0, 6)}`
        demo.updateData((current) => {
          const position = Math.max(0, ...current.trackingLinks.filter((link) => link.group_id === groupId && link.is_active).map((link) => link.position)) + 1000
          return { ...current, trackingLinks: [...current.trackingLinks, { id: `qa-runtime-link-${current.trackingLinks.length + 1}`, source, campaign: campaign.trim(), destination: safeDestination, slug: uniqueSlug, visits: 0, leads: 0, customers: 0, is_active: true, archived_at: null, archived_by: null, created_by: QA_FIXTURE_USER_ID, created_at: now, group_id: groupId, position }] }
        })
      } else {
        await createTrackingLink({ source, campaign, destination: safeDestination, groupId })
        await refresh()
      }
      setCampaign('')
      toast.success('Tracking link created.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tracking link could not be created.')
    } finally {
      setSaving(false)
    }
  }

  const createGroup = async () => {
    const name = newGroupName.trim()
    if (!name) return void toast.error('Group name is required.')
    if (name.length > 80) return void toast.error('Group name must be 80 characters or fewer.')
    setWorkingId('new-group')
    try {
      let id: string
      if (demo.enabled) {
        id = `qa-runtime-group-${Date.now()}`
        const now = new Date().toISOString()
        demo.updateData((current) => ({ ...current, trackingLinkGroups: [...current.trackingLinkGroups, { id, name, position: Math.max(0, ...current.trackingLinkGroups.map((group) => group.position)) + 1000, created_by: QA_FIXTURE_USER_ID, created_at: now, updated_at: now }] }))
      } else {
        id = await createTrackingLinkGroup(name)
        await refresh()
      }
      setSelectedGroup(id)
      setNewGroupName('')
      setCreatingGroup(false)
      toast.success('Link group created.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Link group could not be created.')
    } finally {
      setWorkingId(null)
    }
  }

  const renameGroup = async (group: TrackingLinkGroup) => {
    const name = window.prompt('Rename link group', group.name)?.trim()
    if (!name || name === group.name) return
    if (name.length > 80) return void toast.error('Group name must be 80 characters or fewer.')
    setWorkingId(`group:${group.id}`)
    try {
      if (demo.enabled) demo.updateData((current) => ({ ...current, trackingLinkGroups: current.trackingLinkGroups.map((item) => item.id === group.id ? { ...item, name, updated_at: new Date().toISOString() } : item) }))
      else { await renameTrackingLinkGroup(group.id, name); await refresh() }
      toast.success('Link group renamed.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Link group could not be renamed.')
    } finally { setWorkingId(null) }
  }

  const removeGroup = async (group: TrackingLinkGroup) => {
    const groupLinks = links.filter((link) => link.group_id === group.id)
    const message = groupLinks.length
      ? `Delete “${group.name}” and move its ${groupLinks.length} ${groupLinks.length === 1 ? 'link' : 'links'} to Ungrouped?`
      : `Delete the empty group “${group.name}”?`
    if (!window.confirm(message)) return
    setWorkingId(`group:${group.id}`)
    try {
      if (demo.enabled) {
        demo.updateData((current) => ({
          ...current,
          trackingLinkGroups: current.trackingLinkGroups.filter((item) => item.id !== group.id),
          trackingLinks: current.trackingLinks.map((link) => link.group_id === group.id ? { ...link, group_id: null } : link),
        }))
      } else {
        const result = await deleteTrackingLinkGroup(group.id, groupLinks.length > 0)
        if (result.status !== 'DELETED') throw new Error(result.status === 'PROTECTED' ? 'Move the group links before deleting it.' : 'Link group no longer exists.')
        await refresh()
      }
      if (selectedGroup === group.id) setSelectedGroup(UNGROUPED_TRACKING_LINKS)
      toast.success(groupLinks.length ? 'Group deleted. Links moved to Ungrouped.' : 'Link group deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Link group could not be deleted.')
    } finally { setWorkingId(null) }
  }

  const copy = async (link: TrackingLink) => {
    if (!integrationReady) return void toast.error('Tracking deployment is required before this URL can be used.')
    try {
      await navigator.clipboard.writeText(trackingRedirectUrl(link.slug))
      setCopiedId(link.id)
      window.setTimeout(() => setCopiedId((current) => current === link.id ? null : current), 2000)
    } catch { toast.error('Copy failed. Select the tracked URL and copy it manually.') }
  }

  const setArchived = async (link: TrackingLink, archived: boolean) => {
    setWorkingId(link.id)
    try {
      if (demo.enabled) {
        demo.updateData((current) => ({ ...current, trackingLinks: current.trackingLinks.map((item) => item.id === link.id ? { ...item, is_active: !archived, archived_at: archived ? new Date().toISOString() : null, archived_by: archived ? QA_FIXTURE_USER_ID : null } : item) }))
      } else { await setTrackingLinkArchived(link.id, archived); await refresh() }
      toast.success(archived ? 'Tracking link archived.' : 'Tracking link reactivated.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tracking link could not be updated.')
    } finally { setWorkingId(null) }
  }

  const removeLink = async (link: TrackingLink) => {
    if (!window.confirm(`Delete this unused tracking link?\n\n${link.campaign}`)) return
    setWorkingId(link.id)
    try {
      const result = demo.enabled
        ? link.visits + link.leads + link.customers === 0 ? { status: 'DELETED' as const } : { status: 'PROTECTED' as const }
        : await deleteTrackingLinkIfUnused(link.id)
      if (result.status === 'PROTECTED') return void toast.error('This link has attributed activity. Archive it instead.')
      if (result.status !== 'DELETED') throw new Error('Tracking link no longer exists.')
      if (demo.enabled) demo.updateData((current) => ({ ...current, trackingLinks: current.trackingLinks.filter((item) => item.id !== link.id) }))
      else await refresh()
      toast.success('Unused tracking link deleted.')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Tracking link could not be deleted.')
    } finally { setWorkingId(null) }
  }

  const persistMove = async (link: TrackingLink, groupId: string | null, position: number) => {
    const targetCount = trackingLinksInGroup(links.filter((item) => item.is_active && item.id !== link.id), groupId).length
    const safePosition = Math.min(Math.max(position, 0), targetCount)
    const previous = links
    const next = moveTrackingLinkLocally(links, link.id, groupId, safePosition)
    setLinks(next)
    setWorkingId(link.id)
    try {
      if (demo.enabled) demo.updateData((current) => ({ ...current, trackingLinks: moveTrackingLinkLocally(current.trackingLinks, link.id, groupId, safePosition) }))
      else { await moveTrackingLink(link.id, groupId, safePosition); await refresh() }
    } catch (error) {
      setLinks(previous)
      toast.error(error instanceof Error ? error.message : 'Link order could not be saved. The previous order was restored.')
    } finally { setWorkingId(null) }
  }

  const persistGroupOrder = async (orderedIds: string[]) => {
    const previous = groups
    const next = reorderTrackingGroupsLocally(groups, orderedIds)
    setGroups(sortTrackingGroups(next))
    setWorkingId('group-order')
    try {
      if (demo.enabled) demo.updateData((current) => ({ ...current, trackingLinkGroups: reorderTrackingGroupsLocally(current.trackingLinkGroups, orderedIds) }))
      else { await reorderTrackingLinkGroups(orderedIds); await refresh() }
    } catch (error) {
      setGroups(previous)
      toast.error(error instanceof Error ? error.message : 'Group order could not be saved. The previous order was restored.')
    } finally { setWorkingId(null) }
  }

  const onDragStart = ({ active }: DragStartEvent) => {
    const type = active.data.current?.type
    const id = fromDragId(active.id)
    setActiveDragLabel(type === 'group' ? groups.find((group) => group.id === id)?.name ?? 'Link group' : links.find((link) => link.id === id)?.campaign ?? 'Tracking link')
  }

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveDragLabel(null)
    if (!over || active.id === over.id) return
    const type = active.data.current?.type
    if (type === 'group') {
      const activeId = fromDragId(active.id)
      const overGroupValue = String(over.data.current?.groupId ?? fromDragId(over.id))
      if (overGroupValue === UNGROUPED_TRACKING_LINKS) return
      const oldIndex = orderedGroups.findIndex((group) => group.id === activeId)
      const newIndex = orderedGroups.findIndex((group) => group.id === overGroupValue)
      if (oldIndex >= 0 && newIndex >= 0) void persistGroupOrder(arrayMove(orderedGroups, oldIndex, newIndex).map((group) => group.id))
      return
    }
    if (type === 'link') {
      const link = links.find((item) => item.id === fromDragId(active.id))
      if (!link) return
      const targetGroupValue = String(over.data.current?.groupId ?? UNGROUPED_TRACKING_LINKS)
      const targetGroupId = trackingGroupId(targetGroupValue)
      const targetLinks = trackingLinksInGroup(links.filter((item) => item.is_active && item.id !== link.id), targetGroupId)
      const targetPosition = over.data.current?.type === 'link'
        ? Math.max(0, targetLinks.findIndex((item) => item.id === fromDragId(over.id)))
        : targetLinks.length
      void persistMove(link, targetGroupId, targetPosition)
    }
  }

  return (
    <div className="space-y-5">
      <RecordHeader eyebrow="Settings" title="Tracking Links" onBack={() => navigate('/admin/settings')} />
      <ReadinessNotice state={readiness.categories.tracking} />

      <Panel title="New link">
        <div className="grid gap-4 lg:grid-cols-[180px_minmax(210px,0.75fr)_minmax(190px,0.65fr)_minmax(280px,1.2fr)]">
          <SelectField label="Source" value={source} onChange={setSource} options={LINK_SOURCES} />
          <TextField label="Campaign" value={campaign} onChange={setCampaign} placeholder="August driveway campaign" />
          <SelectField
            label="Group"
            value={selectedGroup}
            onChange={setSelectedGroup}
            options={[UNGROUPED_TRACKING_LINKS, ...orderedGroups.map((group) => group.id)]}
            renderOption={(value) => value === UNGROUPED_TRACKING_LINKS ? 'Ungrouped' : groups.find((group) => group.id === value)?.name ?? value}
          />
          <TextField label="Destination" value={destination} onChange={setDestination} />
        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1 rounded-xl border border-line bg-raised px-4 py-3">
            <div className="font-label text-[12px] font-semibold uppercase tracking-[0.14em] text-cc-muted">Tracked URL preview</div>
            <div className="mt-1 truncate text-[14px] text-ice" title={preview}>{preview}</div>
          </div>
          <PrimaryButton onClick={() => void generate()} disabled={saving || !integrationReady} icon={<Link2 className="h-4 w-4" strokeWidth={2.2} />}>
            {saving ? 'Generating' : 'Generate Link'}
          </PrimaryButton>
        </div>
      </Panel>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[13px] leading-relaxed text-cc-muted">Visits count once per link per rolling 30-minute browser session.</p>
        <div className="flex items-center gap-2 self-end sm:self-auto">
          <SecondaryButton onClick={() => setCreatingGroup((current) => !current)} disabled={!integrationReady} icon={<FolderPlus className="h-4 w-4" />}>
            New Group
          </SecondaryButton>
          <SegmentControl
            options={[
              { value: 'ACTIVE' as const, label: `Active ${links.filter((link) => link.is_active).length}` },
              { value: 'ARCHIVED' as const, label: `Archived ${links.filter((link) => !link.is_active).length}` },
            ]}
            value={view}
            onChange={setView}
            size="sm"
          />
        </div>
      </div>

      {creatingGroup && (
        <Panel title="Create link group">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <TextField label="Group name" value={newGroupName} onChange={setNewGroupName} placeholder="Seasonal campaigns" className="flex-1" />
            <PrimaryButton onClick={() => void createGroup()} disabled={workingId === 'new-group'} icon={<Plus className="h-4 w-4" />}>
              {workingId === 'new-group' ? 'Creating' : 'Create Group'}
            </PrimaryButton>
          </div>
        </Panel>
      )}

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragCancel={() => setActiveDragLabel(null)} onDragEnd={onDragEnd}>
        <SortableContext items={orderedGroups.map((group) => groupDragId(group.id))} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {groupCards.map(({ group }) => {
              const groupId = group?.id ?? null
              const groupLinks = trackingLinksInGroup(visibleLinks, groupId)
              const collapseId = trackingGroupValue(groupId)
              return (
                <TrackingGroupCard
                  key={collapseId}
                  group={group}
                  links={groupLinks}
                  groups={groups}
                  collapsed={collapsed.has(collapseId)}
                  canOrganize={canOrganize}
                  integrationReady={integrationReady}
                  workingId={workingId}
                  copiedId={copiedId}
                  onToggle={() => setCollapsed((current) => {
                    const next = new Set(current)
                    if (next.has(collapseId)) next.delete(collapseId); else next.add(collapseId)
                    return next
                  })}
                  onRename={(item) => void renameGroup(item)}
                  onDeleteGroup={(item) => void removeGroup(item)}
                  onCopy={(item) => void copy(item)}
                  onArchive={(item, archived) => void setArchived(item, archived)}
                  onDeleteLink={(item) => void removeLink(item)}
                  onMove={(item, targetGroupId, position) => void persistMove(item, targetGroupId, position)}
                />
              )
            })}
            {visibleLinks.length === 0 && view === 'ARCHIVED' && <Panel><div className="py-4 text-[15px] text-cc-muted">No archived tracking links.</div></Panel>}
          </div>
        </SortableContext>
        <DragOverlay dropAnimation={{ duration: 180, easing: 'ease-out' }}>
          {activeDragLabel && <div className="rounded-xl border border-ice/40 bg-raised px-4 py-3 text-[14px] font-semibold text-ink shadow-lifted">{activeDragLabel}</div>}
        </DragOverlay>
      </DndContext>
    </div>
  )
}
