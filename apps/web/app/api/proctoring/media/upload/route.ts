import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const eventId = String(formData.get('event_id') ?? '')
  if (!eventId) return NextResponse.json({ error: 'event_id required' }, { status: 400 })

  return NextResponse.json({
    ok: true,
    event_id: eventId,
    clip_url: `/api/proctoring/media/${eventId}/clip.webm`,
    snapshot_url: `/api/proctoring/media/${eventId}/snapshot.jpg`,
  })
}
