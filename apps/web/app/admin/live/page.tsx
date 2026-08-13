import { LiveSessionMonitor } from '@/components/recruiter/live-session-monitor'

export const dynamic = 'force-dynamic'

export default async function AdminLivePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { sessionId } = await searchParams

  return (
    <LiveSessionMonitor
      initialSessionId={sessionId ?? null}
      title="Admin live monitor"
      eyebrow="Operations view"
      backHref="/admin"
      backLabel="Back to admin"
    />
  )
}