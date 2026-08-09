'use client'

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  AlertTriangle,
  BriefcaseIcon,
  UsersIcon,
  CheckCircleIcon,
  BarChart3Icon,
  RefreshCcwIcon,
} from "lucide-react"
import { useSession } from "@/lib/auth-client"
import {
  getRecruiterJobs,
  getCompletedInterviews,
  getShortlistCandidates,
  moveToShortlist,
  hireCandidate,
  rejectCandidate,
} from "@/app/actions/core"

// ─── Types ───────────────────────────────────────────────────────────────────
// Dates arrive as ISO strings from the server action (safe across the boundary)

type InterviewData = {
  id: number
  candidateName: string
  jobTitle: string
  company: string
  scheduledAt: string
  status: 'scheduled' | 'baseline' | 'active' | 'completed' | 'cancelled' | 'missed' | 'rescheduled'
  riskScore: number | null
  interviewScore: number | null
  humanReviewRequired: boolean
}

type ShortlistData = {
  candidateId: number
  candidateName: string
  jobTitle: string
  company: string
  jobId: number
  interviewId: number | null
  scheduledAt: string | null
  riskScore: number | null
  interviewScore: number | null
  humanReviewRequired: boolean
}

// ─── Component ────────────────────────────────────────────────────────────────

export function RecruiterDashboard() {
  const [activeTab, setActiveTab] = useState<'completed' | 'shortlist'>('completed')
  const [completedInterviews, setCompletedInterviews] = useState<InterviewData[]>([])
  const [shortlist, setShortlist] = useState<ShortlistData[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [openJobs, setOpenJobs] = useState<{ id: number; title: string; organizationName: string }[]>([])

  const { data: session } = useSession()

  // ─── Load data ────────────────────────────────────────────────────────────

  const loadData = async () => {
    if (!session?.user?.id) {
      setLoading(false)
      return
    }

    setLoading(true)
    try {
      const [jobs, completed, candidates] = await Promise.all([
        getRecruiterJobs(),
        getCompletedInterviews(),
        getShortlistCandidates(),
      ])

      setOpenJobs(jobs)
      setCompletedInterviews(completed as InterviewData[])
      setShortlist(candidates as ShortlistData[])
    } catch (err) {
      console.error('Failed to load recruiter data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id])

  // ─── Mutations ────────────────────────────────────────────────────────────

  const handleMoveToShortlist = async (interviewId: number) => {
    const result = await moveToShortlist(interviewId)
    if (result.ok) {
      await loadData()
    } else {
      alert(`Failed to move to shortlist: ${result.error}`)
    }
  }

  const handleHire = async (candidateId: number, jobId: number) => {
    const result = await hireCandidate(candidateId, jobId)
    if (result.ok) {
      await loadData()
    } else {
      alert(`Failed to hire candidate: ${result.error}`)
    }
  }

  const handleReject = async (candidateId: number, jobId: number) => {
    const result = await rejectCandidate(candidateId, jobId)
    if (result.ok) {
      await loadData()
    } else {
      alert(`Failed to reject candidate: ${result.error}`)
    }
  }

  // ─── Helpers ──────────────────────────────────────────────────────────────

  const formatDateTime = (iso: string | null) => {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.toLocaleDateString()} ${d.toLocaleTimeString()}`
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Recruiter Workspace</h1>
          <p className="mt-2 text-muted-foreground">Manage jobs, schedule interviews, and review candidates</p>
          <p className="mt-2 inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-700">
            Demo Mode: Recruiter Access
          </p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Jobs</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <BriefcaseIcon className="size-5 text-primary" />
              <span className="text-2xl font-bold">{openJobs.length}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Candidates</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <UsersIcon className="size-5 text-primary" />
              <span className="text-2xl font-bold">—</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Scheduled</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <CheckCircleIcon className="size-5 text-primary" />
              <span className="text-2xl font-bold">—</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Completed</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <BarChart3Icon className="size-5 text-primary" />
              <span className="text-2xl font-bold">{completedInterviews.length}</span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Missed</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <AlertTriangle className="size-5 text-destructive" />
              <span className="text-2xl font-bold text-destructive">
                {completedInterviews.filter((i) => i.status === 'missed').length}
              </span>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Rescheduled</CardTitle>
            </CardHeader>
            <CardContent className="flex items-end gap-2">
              <RefreshCcwIcon className="size-5 text-primary" />
              <span className="text-2xl font-bold">
                {completedInterviews.filter((i) => i.status === 'rescheduled').length}
              </span>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <div className="mt-6">
          <div className="flex space-x-2 mb-4">
            <Button
              variant={activeTab === 'completed' ? 'default' : 'outline'}
              onClick={() => setActiveTab('completed')}
            >
              Completed Interviews
            </Button>
            <Button
              variant={activeTab === 'shortlist' ? 'default' : 'outline'}
              onClick={() => setActiveTab('shortlist')}
            >
              Final Shortlist
            </Button>
          </div>

          {/* Completed Interviews */}
          {activeTab === 'completed' && (
            <div>
              {loading ? (
                <p className="text-center py-4">Loading completed interviews…</p>
              ) : completedInterviews.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No completed interviews found.</p>
              ) : (
                <div className="space-y-4">
                  {completedInterviews.map((interview) => (
                    <div key={interview.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <div className="flex-shrink-0">
                              {interview.status === 'completed' && (
                                <CheckCircleIcon className="size-5 text-green-500" />
                              )}
                              {interview.status === 'missed' && (
                                <AlertTriangle className="size-5 text-destructive" />
                              )}
                              {interview.status === 'rescheduled' && (
                                <RefreshCcwIcon className="size-5 text-primary" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">{interview.candidateName}</p>
                              <p className="text-sm text-muted-foreground">
                                {interview.jobTitle} at {interview.company}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          <p className="text-sm font-medium">{formatDateTime(interview.scheduledAt)}</p>
                          <div className="flex items-center gap-2">
                            {interview.riskScore !== null && (
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  interview.riskScore >= 80
                                    ? 'bg-red-100 text-red-700'
                                    : interview.riskScore >= 60
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                Risk: {interview.riskScore}%
                              </span>
                            )}
                            {interview.humanReviewRequired && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                                Human Review
                              </span>
                            )}
                            {interview.interviewScore !== null && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                Score: {interview.interviewScore}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end space-x-3">
                        {interview.status === 'completed' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleMoveToShortlist(interview.id)}
                          >
                            Move to Shortlist
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => alert('Schedule another interview feature coming soon.')}
                        >
                          Schedule Another
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Shortlist */}
          {activeTab === 'shortlist' && (
            <div>
              {loading ? (
                <p className="text-center py-4">Loading shortlist…</p>
              ) : shortlist.length === 0 ? (
                <p className="text-center text-muted-foreground py-4">No candidates in shortlist.</p>
              ) : (
                <div className="space-y-4">
                  {shortlist.map((candidate) => (
                    <div key={candidate.candidateId} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                              Shortlist
                            </span>
                            <div>
                              <p className="font-medium">{candidate.candidateName}</p>
                              <p className="text-sm text-muted-foreground">
                                {candidate.jobTitle} at {candidate.company}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="text-right space-y-1">
                          {candidate.scheduledAt && (
                            <p className="text-sm font-medium">{formatDateTime(candidate.scheduledAt)}</p>
                          )}
                          <div className="flex items-center gap-2">
                            {candidate.riskScore !== null && (
                              <span
                                className={`px-2 py-0.5 text-xs rounded-full ${
                                  candidate.riskScore >= 80
                                    ? 'bg-red-100 text-red-700'
                                    : candidate.riskScore >= 60
                                    ? 'bg-yellow-100 text-yellow-700'
                                    : 'bg-green-100 text-green-700'
                                }`}
                              >
                                Risk: {candidate.riskScore}%
                              </span>
                            )}
                            {candidate.humanReviewRequired && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-700">
                                Human Review
                              </span>
                            )}
                            {candidate.interviewScore !== null && (
                              <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">
                                Score: {candidate.interviewScore}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4 flex justify-end space-x-3">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleHire(candidate.candidateId, candidate.jobId)}
                        >
                          Hire
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleReject(candidate.candidateId, candidate.jobId)}
                        >
                          Reject
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => alert('Schedule another interview feature coming soon.')}
                        >
                          Schedule Another
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </main>
  )
}