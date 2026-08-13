'use client'

import React, { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { useSession } from '@/lib/auth-client'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

export default function RecruiterLivePage() {
  const params = useParams() as { interviewId?: string }
  const interviewId = Number(params?.interviewId ?? 0)
  const { data: session } = useSession()
  const [visibleSession, setVisibleSession] = useState<any | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!interviewId) return
    let mounted = true

    async function poll() {
      try {
        setLoading(true)
        const listRes = await fetch('/api/proctoring/live', { cache: 'no-store' })
        if (!listRes.ok) throw new Error('Failed to fetch live list')
        const list = await listRes.json()
        const match = list.find((s: any) => Number(s.interview_id) === interviewId)
        if (!match) {
          if (mounted) setVisibleSession(null)
          return
        }
        const detailRes = await fetch(`/api/proctoring/live/${encodeURIComponent(match.session_id)}`, { cache: 'no-store' })
        if (!detailRes.ok) {
          if (mounted) setVisibleSession(null)
          return
        }
        const detail = await detailRes.json()
        if (mounted) setVisibleSession(detail)
        setError(null)
      } catch (err) {
        console.error(err)
        if (mounted) setError('Unable to load live view')
      } finally {
        if (mounted) setLoading(false)
      }
    }

    poll()
    const id = window.setInterval(poll, 1000)
    return () => {
      mounted = false
      window.clearInterval(id)
    }
  }, [interviewId])

  // restrict to recruiter/admin only
  const roles = (session as any)?.user?.roles ?? []
  if (!roles.includes('recruiter') && !roles.includes('admin')) {
    return (
      <main className="p-6">
        <Card>
          <CardHeader>
            <CardTitle>Not authorized</CardTitle>
            <CardDescription>You must be a recruiter or admin to view live sessions.</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/recruiter">
              <Button>Back</Button>
            </Link>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Live view — Interview {interviewId}</h1>
          <Link href="/recruiter">
            <Button variant="outline">Back</Button>
          </Link>
        </div>

        {error && <div className="rounded-md p-4 bg-destructive/10 text-destructive">{error}</div>}

        {visibleSession ? (
          <div>
            {visibleSession.risk_level === 'high' && (
              <div className="mb-4 rounded-md bg-destructive/10 border border-destructive/40 p-3 text-destructive font-semibold">High severity active — check events</div>
            )}

            <div className="rounded-xl border p-4">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <div className="text-lg font-semibold">{visibleSession.candidate_name}</div>
                  <div className="text-sm text-muted-foreground">{visibleSession.job_title}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={visibleSession.risk_level === 'high' ? 'destructive' : 'outline'}>
                    {visibleSession.risk_level}
                  </Badge>
                  <Badge variant="outline">{visibleSession.status}</Badge>
                </div>
              </div>

              <div className="aspect-video mb-3 bg-slate-900 rounded-md overflow-hidden">
                {visibleSession.snapshot_url ? (
                  <img
                    src={`${visibleSession.snapshot_url}?v=${encodeURIComponent(visibleSession.last_seen_at)}`}
                    alt="live snapshot"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="p-6 text-center text-sm text-muted-foreground">No snapshot yet</div>
                )}
              </div>

              <div className="text-sm text-muted-foreground">Updated {new Date(visibleSession.last_seen_at).toLocaleTimeString()}</div>
            </div>
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">No active live session for interview {interviewId}</CardContent>
          </Card>
        )}
      </div>
    </main>
  )
}
