import { NextResponse } from 'next/server'
import { proctoringStore } from '../store'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  return NextResponse.json(proctoringStore.events.get(sessionId) ?? [])
}

export async function POST(request: Request) {
  const body = await request.json()
  const sessionId = String(body.session_id ?? '')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const event = {
    event_id: proctoringStore.nextEventId++,
    session_id: sessionId,
    event_type: String(body.event_type ?? 'unknown'),
    severity: body.severity === 'high' || body.severity === 'medium' ? body.severity : 'low',
    timestamp: String(body.timestamp ?? new Date().toISOString()),
    metadata: body.metadata ?? {},
  }
  proctoringStore.events.set(sessionId, [...(proctoringStore.events.get(sessionId) ?? []), event])
  return NextResponse.json(event)
}
