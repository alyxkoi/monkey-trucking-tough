import { sortAttention, type AttentionItem } from './attention'

export type SalesSort = 'NEWEST' | 'URGENT'

export function sortSales<T>(rows: T[], sort: SalesSort, attention: AttentionItem[], describe: (row:T) => { at:number; paths:string[] }) {
  const ranked = sortAttention(attention).map(item => item.action.to.split('?')[0])
  const rank = (paths:string[]) => {
    const index = ranked.findIndex(path => paths.includes(path))
    return index < 0 ? Number.MAX_SAFE_INTEGER : index
  }
  return [...rows].sort((a,b) => {
    const first = describe(a), second = describe(b)
    return (sort === 'URGENT' ? rank(first.paths) - rank(second.paths) : 0) || second.at - first.at
  })
}
