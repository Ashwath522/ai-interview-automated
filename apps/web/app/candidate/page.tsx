import { CandidateLobby } from '@/components/candidate/candidate-lobby'
import { getCurrentRole } from '@/app/actions/core'
import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function CandidatePage() {
  const role = await getCurrentRole()
  if (role !== 'candidate') redirect('/sign-in')
  return <CandidateLobby />
}

/*
'use client'

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { CheckIcon, ClockIcon, FileTextIcon } from "lucide-react"
import { InterviewFlow } from "@/components/interview-flow"

function CandidatePage_OLD() {
  const [selectedInterview, setSelectedInterview] = useState<string | null>(null)
  const upcomingInterviews = [
    {
      id: "1",
      jobTitle: "Senior Frontend Engineer",
      company: "TechCorp",
      scheduledAt: "Tomorrow at 2:00 PM",
      status: "confirmed",
    },
    {
      id: "2",
      jobTitle: "Product Designer",
      company: "InnovateCo",
      scheduledAt: "Next Monday at 10:00 AM",
      status: "pending",
    },
  ]

  if (selectedInterview) {
    const interview = upcomingInterviews.find((i) => i.id === selectedInterview)
    if (interview) {
      return (
        <main className="min-h-screen bg-background">
          <div className="mx-auto max-w-3xl px-4 py-8 md:px-6">
            <InterviewFlow
              interviewId={selectedInterview}
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
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Interview Lobby</h1>
            <p className="mt-2 text-muted-foreground">Your upcoming interviews</p>
          </div>
          <Button variant="outline">
            Sign out
          </Button>
        </div>

        <Card className="mb-8 bg-gradient-to-br from-primary/10 to-primary/5">
          <CardHeader>
            <CardTitle>Interview Guidelines</CardTitle>
            <CardDescription>Please review before your interview</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-ok" />
              <p>Find a quiet, well-lit space for the interview</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-ok" />
              <p>Test your camera and microphone in advance</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-ok" />
              <p>Have your resume and any relevant materials nearby</p>
            </div>
            <div className="flex gap-3">
              <CheckIcon className="size-5 shrink-0 text-ok" />
              <p>Close unnecessary tabs and notifications</p>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Upcoming Interviews</h2>
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
                  {interview.scheduledAt}
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
                  onClick={() => setSelectedInterview(interview.id)}
                >
                  {interview.status === "confirmed" ? "Enter Interview Room" : "Confirm Interview"}
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
*/
