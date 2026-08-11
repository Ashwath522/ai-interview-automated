'use client'

import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckIcon, ClockIcon, FileTextIcon } from "lucide-react"
import { InterviewFlow } from "@/components/interview-flow"
import { getCandidateInterviews } from "@/app/actions/core"

type CandidateInterview = {
  id: number
  jobTitle: string
  company: string
  scheduledAt: string
  status: string
  durationMinutes: number
}

export function CandidateLobby() {
  const [selectedInterview, setSelectedInterview] = useState<number | null>(null)
  const [upcomingInterviews, setUpcomingInterviews] = useState<CandidateInterview[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    getCandidateInterviews()
      .then(setUpcomingInterviews)
      .finally(() => setLoading(false))
  }, [])

  if (selectedInterview) {
    const interview = upcomingInterviews.find((i) => i.id === selectedInterview)
    if (interview) {
      return (
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
            <InterviewFlow
              interviewId={String(selectedInterview)}
              jobTitle={interview.jobTitle}
              onComplete={() => setSelectedInterview(null)}
            />
          </div>
        </main>
      )
    }
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
        <div className="mb-8">
          <div>
            <h1 className="text-3xl font-bold">Interview Lobby</h1>
            <p className="mt-2 text-muted-foreground">Your upcoming interviews</p>
            <p className="mt-2 inline-block rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700">Demo Mode: Candidate 102</p>
          </div>
        </div>

        <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle>Interview Guidelines</CardTitle>
            <CardDescription>Please review before your interview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-green-600" />
              <p>Find a quiet, well-lit space for the interview</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-green-600" />
              <p>Test your camera and microphone in advance</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-green-600" />
              <p>Have your resume and any relevant materials nearby</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-green-600" />
              <p>Close unnecessary tabs and notifications</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Upcoming Interviews</h2>
          {loading && <p className="text-sm text-muted-foreground">Loading interviews...</p>}
          {!loading && upcomingInterviews.length === 0 && (
            <Card>
              <CardContent className="py-6 text-sm text-muted-foreground">
                No interviews are scheduled for your account yet.
              </CardContent>
            </Card>
          )}
          {upcomingInterviews.map((interview) => (
            <Card key={interview.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg">{interview.jobTitle}</CardTitle>
                    <CardDescription>{interview.company}</CardDescription>
                  </div>
                  <span className="inline-block rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary capitalize">
                    {interview.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-col gap-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <ClockIcon className="size-4" />
                  {new Date(interview.scheduledAt).toLocaleString()}
                </div>

                <div className="rounded-lg bg-muted p-4">
                  <h4 className="font-medium text-sm mb-2">What to Expect</h4>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2">
                      <FileTextIcon className="size-4 shrink-0 mt-0.5" />
                      <span>Initial screening and role overview (5 min)</span>
                    </li>
                    <li className="flex gap-2">
                      <FileTextIcon className="size-4 shrink-0 mt-0.5" />
                      <span>Technical or case discussion (20 min)</span>
                    </li>
                    <li className="flex gap-2">
                      <FileTextIcon className="size-4 shrink-0 mt-0.5" />
                      <span>Your questions and closing remarks (5 min)</span>
                    </li>
                  </ul>
                </div>

                <Button 
                  className="w-full"
                  onClick={() => {
                    setSelectedInterview(interview.id)
                  }}
                  disabled={interview.status === 'completed' || interview.status === 'cancelled'}
                >
                  {interview.status === "completed" ? "Completed" : "Enter Interview Room"}
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card className="mt-8 bg-muted">
          <CardHeader>
            <CardTitle className="text-base">Privacy & Consent</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>
              CoreLink records interviews with your consent to help interviewers provide fair
              feedback. You can review what was recorded after your interview.
            </p>
            <p className="text-muted-foreground">
              Your interview data is stored securely and deleted after 90 days unless you request
              otherwise.
            </p>
          </CardContent>
        </Card>
      </div>
    </main>
  )
}
