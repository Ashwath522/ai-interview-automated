import { NextResponse } from 'next/server'
import { proctoringStore } from '../store'
import { auth } from '@/lib/auth'

export async function GET(request: Request) {
  // require a logged-in session
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { searchParams } = new URL(request.url)
  const sessionId = searchParams.get('session_id')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })
  return NextResponse.json(proctoringStore.risks.get(sessionId) ?? null)
}

export async function POST(request: Request) {
  // require a logged-in session
  const session = await auth.api.getSession({ headers: request.headers })
  if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const body = await request.json()
  const sessionId = String(body.session_id ?? '')
  if (!sessionId) return NextResponse.json({ error: 'session_id required' }, { status: 400 })

  const prev = proctoringStore.risks.get(sessionId) as { score?: number } | undefined
  const incoming = Number(body.score ?? 0)
  const score = Math.max(incoming, Number(prev?.score ?? 0))

  const risk = {
    session_id: sessionId,
    score,
    level: body.level ?? 'low',
    breakdown: body.breakdown ?? {},
    evidence_count: Number(body.evidenceCount ?? body.evidence_count ?? 0),
    timestamp: body.timestamp ?? Date.now(),
  }
  proctoringStore.risks.set(sessionId, risk)
  return NextResponse.json(risk)
}
