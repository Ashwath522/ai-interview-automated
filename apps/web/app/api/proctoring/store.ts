export type StoredEvent = {
  event_id: number
  session_id: string
  event_type: string
  severity: 'low' | 'medium' | 'high'
  timestamp: string
  metadata: Record<string, unknown>
  clip_url?: string
  snapshot_url?: string
}

type Store = {
  nextEventId: number
  events: Map<string, StoredEvent[]>
  risks: Map<string, Record<string, unknown>>
}

const globalStore = globalThis as typeof globalThis & { __corelinkProctoringStore?: Store }

export const proctoringStore =
  globalStore.__corelinkProctoringStore ??
  (globalStore.__corelinkProctoringStore = {
    nextEventId: 1,
    events: new Map<string, StoredEvent[]>(),
    risks: new Map<string, Record<string, unknown>>(),
  })
