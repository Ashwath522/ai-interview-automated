import { LiveSessionMonitor } from '@/components/recruiter/live-session-monitor'

export const dynamic = 'force-dynamic'

export default async function RecruiterLivePage({
  searchParams,
}: {
  searchParams: Promise<{ sessionId?: string }>
}) {
  const { sessionId } = await searchParams

  return (
    <LiveSessionMonitor
      initialSessionId={sessionId ?? null}
      title="Recruiter live monitor"
      eyebrow="Interviewer view"
      backHref="/recruiter"
      backLabel="Back to dashboard"
    />
  )
}