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

export type StoredMedia = {
  snapshot?: Uint8Array
  clip?: Uint8Array
  snapshotContentType?: string
  clipContentType?: string
}

type Store = {
  nextEventId: number
  events: Map<string, StoredEvent[]>
  risks: Map<string, Record<string, unknown>>
  media: Map<number, StoredMedia>
}

const globalStore = globalThis as typeof globalThis & { __corelinkProctoringStore?: Store }

export const proctoringStore =
  globalStore.__corelinkProctoringStore ??
  (globalStore.__corelinkProctoringStore = {
    nextEventId: 1,
    events: new Map<string, StoredEvent[]>(),
    risks: new Map<string, Record<string, unknown>>(),
    media: new Map<number, StoredMedia>(),
  })

export function attachMediaToEvent(
  sessionId: string,
  eventId: number,
  urls: { snapshot_url?: string; clip_url?: string },
) {
  const events = proctoringStore.events.get(sessionId) ?? []
  const index = events.findIndex((event) => event.event_id === eventId)
  if (index < 0) return
  events[index] = { ...events[index], ...urls }
  proctoringStore.events.set(sessionId, events)
}

export function getEventsForInterview(interviewId: number): StoredEvent[] {
  return proctoringStore.events.get(`interview:${interviewId}`) ?? []
}
