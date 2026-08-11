import { NextResponse } from 'next/server'
import { proctoringStore } from '../store'

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  return NextResponse.json(proctoringStore.risks.get(sessionId) ?? null)
}

export async function POST(request: Request) {
  const body = await request.json()
  const sessionId = String(body.session_id ?? '')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const risk = {
    session_id: sessionId,
    score: Number(body.score ?? 0),
    level: body.level ?? 'low',
    breakdown: body.breakdown ?? {},
    evidence_count: Number(body.evidenceCount ?? body.evidence_count ?? 0),
    timestamp: body.timestamp ?? Date.now(),
  }
  proctoringStore.risks.set(sessionId, risk)
  return NextResponse.json(risk)
}
